import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { createGzip } from "node:zlib";

const port = Number(process.env.E2E_PORT ?? 4173);
const exportRoot = resolve(process.cwd(), "out");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function findExportedFile(pathname, preferRscPayload = false) {
  const decodedPath = decodeURIComponent(pathname).replace(/^\/+/, "");
  const requestedPath = resolve(
    exportRoot,
    decodedPath || (preferRscPayload ? "index.txt" : "index.html"),
  );
  if (requestedPath !== exportRoot && !requestedPath.startsWith(`${exportRoot}${sep}`)) return null;

  const flattenedPayload = basename(requestedPath).match(/^(__next\.[^.]+)\.(.+)\.txt$/);
  const payloadCandidate = flattenedPayload
    ? resolve(
        dirname(requestedPath),
        flattenedPayload[1],
        ...flattenedPayload[2].split(".").slice(0, -1),
        `${flattenedPayload[2].split(".").at(-1)}.txt`,
      )
    : null;
  const candidates = extname(requestedPath)
    ? [requestedPath, payloadCandidate].filter(Boolean)
    : preferRscPayload
      ? [`${requestedPath}.txt`, requestedPath]
      : [requestedPath, `${requestedPath}.html`, resolve(requestedPath, "index.html")];

  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next static-export path shape.
    }
  }
  return null;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  const wantsRscPayload = request.headers.rsc === "1";
  let file = await findExportedFile(url.pathname, wantsRscPayload);
  let status = 200;

  /* Nothing matched. Every real static host — S3, nginx's `error_page`, Netlify,
     Vercel, GitHub Pages — answers an unmatched *document* request with the
     exported `404.html` rather than a bare string, and `next build` writes that
     file precisely so they can. Serving plain text here meant the shop's own 404
     was the one page the export server could never show, so nothing exercised it.
     Asset and RSC-payload misses stay plain: a stylesheet request answered with
     a page of HTML is worse than an honest empty 404. */
  if (!file) {
    status = 404;
    const isDocumentRequest =
      !wantsRscPayload && !extname(url.pathname) && !url.pathname.startsWith("/_next/");

    if (isDocumentRequest) file = await findExportedFile("/404.html");

    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
  }

  const extension = extname(file).toLowerCase();
  const shouldCompress = [".css", ".html", ".js", ".svg", ".txt"].includes(extension)
    && request.headers["accept-encoding"]?.includes("gzip");
  response.writeHead(status, {
    "Cache-Control": url.pathname.startsWith("/_next/static/")
      ? "public, max-age=31536000, immutable"
      : url.pathname.startsWith("/images/") || url.pathname.startsWith("/textures/")
        ? "public, max-age=86400, stale-while-revalidate=604800"
      : "no-cache",
    ...(shouldCompress ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } : {}),
    "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
  });
  if (request.method === "HEAD") response.end();
  else if (shouldCompress) createReadStream(file).pipe(createGzip()).pipe(response);
  else createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Static export ready at http://127.0.0.1:${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

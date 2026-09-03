/**
 * Builds `live/` — what gets uploaded to iced-out.node2begin.com.
 *
 *     node tools/live/build-live.mjs                 full build
 *     node tools/live/build-live.mjs --skip-build    reuse frontend/out as it is
 *     node tools/live/build-live.mjs --domain=x.com  build for another host
 *     node tools/live/build-live.mjs --layout=split  backend above the docroot
 *
 * ── TWO LAYOUTS ─────────────────────────────────────────────────────────────
 *
 * `flat` (the default) — ONE directory. The storefront's files and the
 * backend's files sit side by side, and that directory is the document root:
 *
 *     live/site/                 → upload the contents into the docroot
 *     ├── index.html  _next/     the static export
 *     ├── api/v1/                the endpoint files the URLs land on
 *     ├── autoload.php  config/  src/  migrations/  seeds/  bin/  storage/
 *     └── .env                   the credentials
 *
 * `split` — TWO directories. The backend is one folder, `iced-out-api`, placed
 * ABOVE the document root where no URL can reach it:
 *
 *     live/public_html/          → the docroot
 *     live/iced-out-api/         → one level above it
 *
 * The difference is worth being blunt about. Under `flat`, `.env` and
 * `config/database.php` are inside the web root and the only thing stopping a
 * browser fetching them is `.htaccess`. Under `split` they are outside it, and
 * no web-server misconfiguration can expose them because no URL maps there.
 *
 * `flat` is defended in three independent layers, arranged so that failure is
 * LOUD rather than silent: the deny rules live in the same `.htaccess` that maps
 * every clean URL on the site, so if that file stops being read, every page 404s
 * before anything is served. Layer 2 is a deny-all `.htaccess` inside each
 * backend folder; layer 3 is the dot-file rule. See templates/htaccess-root.
 *
 * `api/v1/_backend.php` needs no knowledge of which was built — it walks up
 * looking for autoload.php + config/app.php, and finds either shape.
 *
 * Re-running is safe. `.env` is NEVER overwritten once it exists, and
 * `storage/media` plus `database/iced_out_live.sql` are carried across
 * untouched: they are generated together by build-database.mjs and the dump's
 * rows name the files.
 */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const TEMPLATES = path.join(HERE, "templates");
const LIVE = path.join(REPO, "live");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;

const DOMAIN = option("domain", "iced-out.node2begin.com");
const LAYOUT = option("layout", "flat");
const SKIP_BUILD = flag("skip-build");

if (LAYOUT !== "flat" && LAYOUT !== "split") {
  process.stderr.write(`Unknown --layout=${LAYOUT}. Use "flat" or "split".` + "\n");
  process.exit(1);
}

const FLAT = LAYOUT === "flat";

/** The document root's contents. */
const PUBLIC = FLAT ? path.join(LIVE, "site") : path.join(LIVE, "public_html");

/**
 * Where the backend's files land. Under `flat` that IS the document root — the
 * two halves share one directory, which is the whole point of the layout.
 */
const PRIVATE = FLAT ? PUBLIC : path.join(LIVE, "iced-out-api");

const ENV_FILE = path.join(PRIVATE, ".env");

/**
 * The backend's folders and files. Under `flat` every one of these names is also
 * a path under the document root, so each must appear in the deny list in
 * templates/htaccess-root — which the build checks at the end rather than
 * trusting, because a folder added here and forgotten there is a credential
 * leak that nothing else would report.
 */
const PRIVATE_TREE = ["config", "src", "migrations", "seeds", "bin"];
const PRIVATE_FILES = ["autoload.php", "composer.json"];

/** PRIVATE_TREE plus the two the build creates rather than copies. */
const BACKEND_DIRS = [...PRIVATE_TREE, "database", "storage"];

/**
 * `database/` is NOT copied from the repository on purpose. Its three generated
 * .sql files are of different vintages — the newest is twenty tables behind the
 * migrations — and beside the real dump, in a folder somebody is about to
 * import from, that is a trap rather than a spare. The live bundle carries one
 * file, written by tools/live/build-database.mjs, and a README saying so.
 */

/**
 * The contact sheets seeds/0006_catalogue_images.php cuts every product photo
 * out of. Five files, not the whole 9 MB public/images folder — the rest is
 * already in the export and nothing server-side reads it.
 */
const SEED_IMAGES = [
  "drop-001-products.webp",
  "product-still-life-v2.webp",
  "campaign-after-hours-v2.webp",
  "iced-out-hero.webp",
  "iced-out-og.jpg",
];

/**
 * Carried across a rebuild rather than regenerated, because tools/live/
 * build-database.mjs produced them and they are two halves of one thing: the
 * dump's media_assets rows name the files in storage/media. Losing either
 * silently breaks every product photo on the live site.
 */
const CARRIED = [path.join("storage", "media"), path.join("database", "iced_out_live.sql")];

const say = (line = "") => process.stdout.write(`${line}\n`);
const step = (line) => say(`\n\x1b[1m${line}\x1b[0m`);
const ok = (line) => say(`  \x1b[32m+\x1b[0m ${line}`);
const warn = (line) => say(`  \x1b[33m!\x1b[0m ${line}`);

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function template(name, replacements = {}) {
  let text = await fs.readFile(path.join(TEMPLATES, name), "utf8");

  for (const [key, value] of Object.entries(replacements)) {
    text = text.split(`{{${key}}}`).join(value);
  }

  return text;
}

async function write(target, contents) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents, "utf8");
}

async function countFiles(directory) {
  let total = 0;

  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    total += entry.isDirectory() ? await countFiles(path.join(directory, entry.name)) : 1;
  }

  return total;
}

async function directorySize(directory) {
  let bytes = 0;

  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    bytes += entry.isDirectory() ? await directorySize(full) : (await fs.stat(full)).size;
  }

  return bytes;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Moved out of the way of the wipe, then moved back. @returns the paths saved. */
async function stashCarried() {
  const stash = path.join(LIVE, ".carry");
  await fs.rm(stash, { recursive: true, force: true });

  const saved = [];

  for (const relative of CARRIED) {
    const from = path.join(PRIVATE, relative);

    if (!(await exists(from))) {
      continue;
    }

    const to = path.join(stash, relative);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    saved.push(relative);
  }

  return saved;
}

async function restoreCarried(saved) {
  const stash = path.join(LIVE, ".carry");

  for (const relative of saved) {
    const to = path.join(PRIVATE, relative);
    await fs.rm(to, { recursive: true, force: true });
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(path.join(stash, relative), to);
  }

  await fs.rm(stash, { recursive: true, force: true });
}

/* ───────────────────────────────────────────────────────────────────────────
   1. The frontend export
   ─────────────────────────────────────────────────────────────────────────── */

async function buildFrontend() {
  const out = path.join(REPO, "frontend", "out");

  if (SKIP_BUILD) {
    if (!(await exists(path.join(out, "index.html")))) {
      throw new Error("--skip-build was passed but frontend/out has no index.html. Build once first.");
    }

    warn("--skip-build: reusing frontend/out as it stands");
    return out;
  }

  /**
   * `.env.local` carries the development Razorpay TEST key, and Next bakes
   * NEXT_PUBLIC_* into the bundle at build time — so a plain `npm run build`
   * ships rzp_test_… to the live shop. Blanking it here (this file outranks
   * .env.local for a production build) makes the storefront read the key from
   * GET /api/v1/config/storefront instead, which is what makes swapping in the
   * live key a one-line .env change on the server rather than a rebuild.
   */
  await write(
    path.join(REPO, "frontend", ".env.production.local"),
    [
      "# GENERATED by tools/live/build-live.mjs. Production builds only.",
      "#",
      "# Blank on purpose. It outranks .env.local, which holds the development",
      "# TEST key, and keeps that key out of the shipped bundle. The storefront",
      "# then takes the key from GET /api/v1/config/storefront at runtime, so",
      "# RAZORPAY_KEY_ID in the server's .env is the only place it is set.",
      "NEXT_PUBLIC_RAZORPAY_KEY_ID=",
      "",
      "# NEXT_PUBLIC_API_BASE_URL is deliberately ABSENT rather than blank.",
      "#",
      "# Next inlines NEXT_PUBLIC_* at build time, and a key written here as",
      "# `NEXT_PUBLIC_API_BASE_URL=` is inlined as the empty STRING. Left to a",
      "# `??` guard that is `baseURL: \"\"`, and every call in the shop goes to",
      "# /health instead of /api/v1/health. Absent, the variable is undefined and",
      "# api/clients.ts falls back to the relative /api/v1 — which is correct here,",
      "# because Apache serves the export at / and PHP at /api/v1 on one origin.",
      "#",
      "# Set it ONLY if the API genuinely moves to another origin, and then also",
      "# arrange for the session cookie to survive the trip (SameSite=None; Secure).",
    ].join("\n"),
  );

  step("Building the storefront (next build → static export)");

  const result = spawnSync("npm", ["run", "build"], {
    cwd: path.join(REPO, "frontend"),
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });

  if (result.status !== 0) {
    throw new Error(`next build failed with exit code ${result.status}.`);
  }

  if (!(await exists(path.join(out, "index.html")))) {
    throw new Error("next build finished but frontend/out/index.html is missing.");
  }

  return out;
}

/* ───────────────────────────────────────────────────────────────────────────
   2. The document root
   ─────────────────────────────────────────────────────────────────────────── */

async function assemblePublic(out) {
  step(`Assembling ${path.relative(REPO, PUBLIC).replace(/\\/g, "/")}`);

  await fs.cp(out, PUBLIC, { recursive: true });
  ok(`static export — ${await countFiles(PUBLIC)} files`);

  await write(path.join(PUBLIC, ".htaccess"), await template("htaccess-root"));
  ok(".htaccess — https, clean URLs, 404 page, and the /iced-out-api block");

  await write(path.join(PUBLIC, "_next", ".htaccess"), await template("htaccess-next"));
  ok("_next/.htaccess — immutable caching for the hashed bundles");

  /**
   * The endpoint tree, copied wholesale so every file keeps its relative hop up
   * to bootstrap.php. README.md is dropped: it is documentation, and inside a
   * document root documentation is a URL.
   */
  const apiRoot = path.join(PUBLIC, "api", "v1");
  await fs.cp(path.join(REPO, "backend", "api"), apiRoot, {
    recursive: true,
    filter: (source) => path.basename(source) !== "README.md",
  });

  /* The three files that know where the private half is. */
  await write(path.join(apiRoot, "_backend.php"), await template("api-backend.php"));
  await write(path.join(apiRoot, "index.php"), await template("api-index.php"));
  await write(path.join(apiRoot, "bootstrap.php"), await template("api-bootstrap.php"));
  await write(path.join(apiRoot, ".htaccess"), await template("htaccess-api"));
  ok(`api/v1 — ${await countFiles(apiRoot)} files`);

  await write(path.join(PUBLIC, "setup.php"), await template("setup.php"));
  ok("setup.php — one-time installer, token-gated, delete after use");

  await write(path.join(PUBLIC, "diagnose.php"), await template("diagnose.php"));
  ok("diagnose.php — reads the error log and the environment, same token gate");

  /**
   * A stamp naming this exact build, served as a plain URL.
   *
   * Worth its two lines: "is the thing I uploaded actually the thing running?"
   * is otherwise unanswerable from outside, and getting it wrong sends you
   * hunting for bugs in code the server is not running. A stale frontend shows
   * up as RSC payload 404s in the console — the browser asking for routes that
   * only exist in the build it came from — which reads like a server fault and
   * is not one.
   */
  const stamp = [
    `built:   ${new Date().toISOString()}`,
    `layout:  ${LAYOUT}`,
    `domain:  ${DOMAIN}`,
    `files:   ${await countFiles(PUBLIC)}`,
    `bundle:  ${(await fs.readdir(path.join(PUBLIC, "_next", "static", "chunks"))).length} chunks`,
    "",
    "Compare this with the build you meant to deploy. If it is older, the upload",
    "did not land — replace the document root's files rather than merging them.",
    "",
  ].join("\n");

  await write(path.join(PUBLIC, "build.txt"), stamp);
  ok(`build.txt — the stamp at https://${DOMAIN}/build.txt`);

  await write(
    path.join(PUBLIC, "robots.txt"),
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      // Belt only. These paths are refused by .htaccess before a crawler's
      // request reaches anything; robots.txt just stops well-behaved ones asking.
      ...BACKEND_DIRS.map((directory) => `Disallow: /${directory}/`),
      "Disallow: /iced-out-api/",
      "",
      `Sitemap: https://${DOMAIN}/sitemap.xml`,
      "",
    ].join("\n"),
  );
  ok("robots.txt");
}

/* ───────────────────────────────────────────────────────────────────────────
   3. The half that holds secrets
   ─────────────────────────────────────────────────────────────────────────── */

async function assemblePrivate(keptEnv) {
  step(`Assembling ${path.relative(REPO, PRIVATE).replace(/\\/g, "/")}`);

  for (const directory of PRIVATE_TREE) {
    await fs.cp(path.join(REPO, "backend", directory), path.join(PRIVATE, directory), { recursive: true });
  }

  for (const file of PRIVATE_FILES) {
    await fs.cp(path.join(REPO, "backend", file), path.join(PRIVATE, file));
  }

  ok(`${PRIVATE_TREE.join(", ")}, ${PRIVATE_FILES.join(", ")}`);

  /* The photographs the catalogue seed cuts from. */
  const imagesTo = path.join(PRIVATE, "seeds", "data", "images");
  await fs.mkdir(imagesTo, { recursive: true });

  for (const name of SEED_IMAGES) {
    const from = path.join(REPO, "frontend", "public", "images", name);

    if (await exists(from)) {
      await fs.cp(from, path.join(imagesTo, name));
    } else {
      warn(`seed image missing: ${name} — product photos will be blank until it is added`);
    }
  }

  ok(`seeds/data/images — ${SEED_IMAGES.length} source sheets`);

  /* Writable at runtime: logs, cache, uploads. */
  for (const directory of ["logs", "cache", "media"]) {
    const full = path.join(PRIVATE, "storage", directory);
    await fs.mkdir(full, { recursive: true });
    await fs.writeFile(path.join(full, ".gitkeep"), "");
  }

  ok("storage/{logs,cache,media} — must stay writable by PHP");

  await write(
    path.join(PRIVATE, "database", "README.md"),
    [
      "# database/",
      "",
      "One file lives here: **`iced_out_live.sql`** — the complete live database,",
      "ready to import. Step 5 of `DEPLOY.md`.",
      "",
      "It is generated by `node tools/live/build-database.mjs`, which builds a real",
      "database from the migrations and seeds and dumps the result. If the file is",
      "missing, that command has not been run since the last rebuild.",
      "",
      "It carries no `CREATE DATABASE` and no `USE`, so it imports into whichever",
      "database you have selected in phpMyAdmin.",
      "",
      "**Import it once, on a fresh install.** Every table is dropped and recreated,",
      "so running it against a site that has taken orders destroys them.",
      "",
      "The repository keeps other `.sql` exports under `backend/database/`. They are",
      "deliberately not copied here: they are of different vintages, and picking the",
      "wrong one gives you a schema twenty tables behind with no error to say so.",
      "",
    ].join("\n"),
  );

  ok("database/README.md — points at the one file to import");

  /**
   * LAYER 2. Under `flat` there is no single backend folder to seal, so the
   * deny-all goes into each one — writing it to PRIVATE would land on the
   * document root's own .htaccess and take the whole site down with it.
   */
  if (FLAT) {
    const denyAll = await template("htaccess-private");

    for (const directory of BACKEND_DIRS) {
      await write(path.join(PRIVATE, directory, ".htaccess"), denyAll);
    }

    ok(`.htaccess deny-all in each of ${BACKEND_DIRS.join(", ")}`);
  } else {
    await write(path.join(PRIVATE, ".htaccess"), await template("htaccess-private"));
    ok(".htaccess — deny-all seatbelt (the folder is above the web root anyway)");
  }

  if (keptEnv !== null) {
    await write(ENV_FILE, keptEnv);
    warn(".env already existed — kept exactly as it was, credentials and all");

    /* Not re-minted, but DEPLOY.md still wants to print the installer link, so
       it is read back out of the file that was kept. */
    const token = keptEnv.match(/^SETUP_TOKEN=(.*)$/m)?.[1].trim() ?? "";

    return token === "" ? null : { SETUP_TOKEN: token, minted: false };
  }

  const secrets = { SESSION_SECRET: randomBytes(32).toString("hex"), SETUP_TOKEN: randomBytes(16).toString("hex") };

  await write(
    ENV_FILE,
    await template("env.production", {
      DOMAIN,
      SESSION_SECRET: secrets.SESSION_SECRET,
      SETUP_TOKEN: secrets.SETUP_TOKEN,
    }),
  );

  ok(".env — fresh, with a SESSION_SECRET and SETUP_TOKEN minted for this deployment");

  return { SETUP_TOKEN: secrets.SETUP_TOKEN, minted: true };
}

/* ───────────────────────────────────────────────────────────────────────────
   3b. The deny list, checked rather than trusted
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * Under `flat` the backend's folders are paths in the document root, and each
 * one is reachable by URL unless the root .htaccess names it. That coupling is
 * the whole risk of this layout, and it is exactly the kind that rots: someone
 * adds a folder to BACKEND_DIRS, the build copies it, and nothing anywhere
 * complains that it is now downloadable.
 *
 * So the build fails rather than shipping a bundle whose deny list has a hole.
 */
async function verifyDenyList() {
  if (!FLAT) {
    return;
  }

  const raw = await fs.readFile(path.join(PUBLIC, ".htaccess"), "utf8");
  // The rules escape dots for the regex (`autoload\.php`); compare on the plain
  // name by dropping every backslash first.
  const rules = raw.split("\\").join("");
  const missing = [...BACKEND_DIRS, ...PRIVATE_FILES].filter((name) => !rules.includes(name));

  if (missing.length > 0) {
    throw new Error(
      `These backend paths are in the document root but are NOT denied by templates/htaccess-root: ` +
        `${missing.join(", ")}. Add them to the RewriteRule deny list before shipping.`,
    );
  }

  if (!raw.includes('<FilesMatch "^' + "\\" + '.">')) {
    throw new Error('templates/htaccess-root has lost its dot-file rule — .env would be served.');
  }

  ok(`deny list checked — ${BACKEND_DIRS.length} folders, ${PRIVATE_FILES.length} files, and dot-files`);
}

/* ─────────────────────────────────────────────────────────────────────────── */

async function main() {
  say(`\x1b[1mIced_out — live build\x1b[0m  →  ${DOMAIN}   (layout: ${LAYOUT})`);

  const out = await buildFrontend();

  /* Read before the wipe: the live database password lives in here. */
  const keptEnv = (await exists(ENV_FILE)) ? await fs.readFile(ENV_FILE, "utf8") : null;
  const carried = await stashCarried();

  /* Under `single` the private half is inside PUBLIC, so this removes both. */
  await fs.rm(PUBLIC, { recursive: true, force: true });
  await fs.rm(PRIVATE, { recursive: true, force: true });

  await assemblePublic(out);
  const secrets = await assemblePrivate(keptEnv);

  await restoreCarried(carried);
  await verifyDenyList();

  if (carried.length > 0) {
    ok(`carried across the rebuild: ${carried.map((p) => p.replace(/\\/g, "/")).join(", ")}`);
  }

  await write(
    path.join(LIVE, "DEPLOY.md"),
    await template(FLAT ? "DEPLOY-flat.md" : "DEPLOY-split.md", {
      DOMAIN,
      SETUP_TOKEN: secrets?.SETUP_TOKEN ?? "(see iced-out-api/.env)",
    }),
  );

  step("Done");

  if (FLAT) {
    say(`  live/site   ${mb(await directorySize(PUBLIC))}  →  upload its CONTENTS into the document root`);
    say(`              storefront and backend together, one directory`);
  } else {
    say(`  live/public_html    ${mb(await directorySize(PUBLIC))}  →  the document root`);
    say(`  live/iced-out-api   ${mb(await directorySize(PRIVATE))}  →  one level ABOVE it`);
  }

  say("");
  say("  Next: open live/DEPLOY.md.");
  say(`  The database credentials go in ${path.relative(LIVE, ENV_FILE).replace(/\\/g, "/")} — that file and no other.`);

  if (!(await exists(path.join(PRIVATE, "database", "iced_out_live.sql")))) {
    say("");
    warn("no iced_out_live.sql yet — run `node tools/live/build-database.mjs` for the one-file import");
  }

  if (secrets !== null) {
    say("");
    say(`  Installer token (SETUP_TOKEN${secrets.minted ? ", newly minted" : ", from the kept .env"}): ${secrets.SETUP_TOKEN}`);
    say(`  https://${DOMAIN}/setup.php?token=${secrets.SETUP_TOKEN}`);
  }

  say("");
}

main().catch((error) => {
  say(`\n\x1b[31m✗ ${error.message}\x1b[0m\n`);
  process.exitCode = 1;
});

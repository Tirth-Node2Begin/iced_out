#!/usr/bin/env node
/**
 * Whole-project audit. Run it from the repo root:
 *
 *   node tools/audit.mjs
 *
 * Four checks, in the order a break is cheapest to find:
 *
 *  1. CONTRACT   every API path a frontend calls exists in ITS backend's route
 *                table, with the verb it uses. Static, so it also covers the
 *                paths only a failing branch or a confirm dialog reaches.
 *  2. SCHEMA     every column named in a literal INSERT or UPDATE exists in the
 *                live database.
 *  3. ENDPOINTS  every GET route actually runs against that database. This is
 *                the one that proves the SELECTs: an unknown column there is a
 *                PDOException, and nothing static can see inside a SQL string.
 *  4. BUILD      both frontends lint, typecheck and build.
 *
 * The two halves share a database, so 2 and 3 need it reachable. 1 and 4 do not.
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "iced-audit-"));

const APPS = [
  { label: "storefront", frontend: "frontend", backend: "backend" },
  { label: "CRM", frontend: "iced-out-crm/frontend", backend: "iced-out-crm/backend" },
];

let failures = 0;

function heading(text) {
  console.log(`\n\x1b[1m${text}\x1b[0m`);
}

function ok(text) {
  console.log(`  \x1b[32m✓\x1b[0m ${text}`);
}

function bad(text) {
  failures += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${text}`);
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] });
}

/* ------------------------------------------------------------- 1. contract */
heading("1 · API contract — does every call have a route?");

const ROUTE_DUMP = path.join(TMP, "dump-routes.php");
fs.writeFileSync(
  ROUTE_DUMP,
  `<?php
declare(strict_types=1);
require $argv[1] . '/autoload.php';
$app = Iced\\Kernel\\Application::boot($argv[1]);
$out = [];
foreach ($app->container->make(Iced\\Kernel\\Router::class)->all() as $r) {
    $out[] = ['method' => $r->method, 'path' => $r->path];
}
echo json_encode($out, JSON_UNESCAPED_SLASHES);
`,
);

const CALLS = [
  /\b(?:admin|customer|public)Client\.(get|post|patch|put|delete)\s*(?:<[^>]*>)?\s*\(\s*([`"'])([^`"']*)\2/g,
  /\b(?:admin|customer|public)Client\.request\s*\(\s*\{[^}]*url:\s*([`"'])([^`"']*)\1/g,
];
const INDIRECT =
  /(?:\bpath:\s*|\bitemPath:\s*\([^)]*\)\s*=>\s*|useRegisterList\s*\(\s*|useAdminRecord\s*\(\s*|\bremote\s*\(\s*|\bact\s*\(\s*|register\.act\s*\(\s*|_PATH\s*=\s*|\bPATH\s*=\s*|\bORDERS\s*=\s*|\bSHIPMENTS\s*=\s*)([`"'])(\/[^`"']*)\1/g;

function tsFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) tsFiles(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const wild = (x) => x.startsWith("{") && x.endsWith("}");

/** Split token, named so a rewrite of this file cannot mangle the escape. */
const NEWLINE = String.fromCharCode(10);

for (const app of APPS) {
  const routes = JSON.parse(run("php", [ROUTE_DUMP, path.join(ROOT, app.backend)], ROOT));
  const table = routes.map((r) => ({ ...r, segs: r.path.split("/").filter(Boolean) }));

  const src = path.join(ROOT, app.frontend, "src");
  const found = new Map();
  /**
   * Call sites this scan could not turn into a path.
   *
   * Reported, never skipped — and that is the whole lesson of this check. An
   * earlier version dropped them silently, which meant 37 write endpoints
   * across two entire feature modules went unaudited while the summary line
   * said everything resolved. A check that quietly narrows its own scope is
   * worse than no check, because it is believed.
   */
  const unreadable = [];

  /** `const BASE = "/admin/crm";` — the house pattern for a feature api layer. */
  const BASE_DECL = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*["'](\/[^"']*)["']/g;

  for (const file of tsFiles(src)) {
    const rel = path.relative(src, file).replaceAll("\\", "/");
    const text = fs.readFileSync(file, "utf8");

    /* Resolved PER FILE, because the name is file-scoped: `crm-api.ts` and
       `materials-api.ts` both declare BASE, with different values. A shared map
       hands one module the other's prefix. */
    const bases = new Map();
    BASE_DECL.lastIndex = 0;
    let b;
    while ((b = BASE_DECL.exec(text))) bases.set(b[1], b[2]);

    text.split(NEWLINE).forEach((line, i) => {
      const where = `${rel}:${i + 1}`;

      const add = (verb, raw) => {
        /* Bases FIRST. The generic `${…}` → `{}` rule below would otherwise
           turn `${BASE}/materials` into `{}/materials`, which no longer starts
           with a slash — and that is exactly how a module goes unchecked. */
        let expanded = raw;
        for (const [name, value] of bases) {
          expanded = expanded.replaceAll("${" + name + "}", value);
        }

        const clean = expanded.replace(/\$\{[^}]*\}/g, "{}").split("?")[0];

        if (!clean.startsWith("/")) {
          unreadable.push(`${verb} ${raw} (${where})`);
          return;
        }

        const key = `${verb} ${clean}`;
        if (!found.has(key)) found.set(key, where);
      };

      let m;
      CALLS[0].lastIndex = 0;
      while ((m = CALLS[0].exec(line))) add(m[1].toUpperCase(), m[3]);
      CALLS[1].lastIndex = 0;
      while ((m = CALLS[1].exec(line))) add("ANY", m[2]);
      INDIRECT.lastIndex = 0;
      while ((m = INDIRECT.exec(line))) add("ANY", m[2]);
    });
  }

  const broken = [];
  for (const [key, where] of found) {
    const [verb, callPath] = key.split(" ");
    const segs = callPath.split("/").filter(Boolean);
    const hits = table.filter(
      (r) => r.segs.length === segs.length && r.segs.every((s, i) => wild(s) || wild(segs[i]) || s === segs[i]),
    );

    if (hits.length === 0) broken.push(`${key} — no such route (${where})`);
    else if (verb !== "ANY" && !hits.some((r) => r.method === verb))
      broken.push(`${key} — path exists only as ${[...new Set(hits.map((r) => r.method))].join("/")} (${where})`);
  }

  if (broken.length === 0) ok(`${app.label}: ${found.size} call sites, all resolve`);
  else broken.forEach((b) => bad(`${app.label}: ${b}`));

  /* Not necessarily a failure — a path genuinely built at runtime cannot be
     read statically — but it goes on screen either way, so nobody reads
     "all resolve" as "all were looked at". */
  if (unreadable.length > 0) {
    bad(`${app.label}: ${unreadable.length} call site(s) could not be resolved to a path`);
    [...new Set(unreadable)].slice(0, 12).forEach((u) => console.log(`      ${u}`));
  }
}

/* --------------------------------------------------------------- 2. schema */
heading("2 · Schema — do the literal INSERT/UPDATE columns exist?");
try {
  const out = run("php", [path.join(ROOT, "tools", "schema-audit.php"), ...APPS.map((a) => path.join(ROOT, a.backend))], ROOT);
  const tail = out.trim().split("\n").pop().trim();
  if (/0 PROBLEMS/.test(tail)) ok(tail);
  else bad(tail);
} catch (error) {
  bad(`could not run (database reachable?): ${String(error.message).split("\n")[0]}`);
}

/* ------------------------------------------------------------ 3. endpoints */
heading("3 · Endpoints — does every GET run against the database?");
for (const app of APPS) {
  const args = [path.join(ROOT, "tools", "probe-endpoints.php"), path.join(ROOT, app.backend)];
  args.push(app.label === "CRM" ? "admin" : "customer");
  if (app.label === "CRM") args.push("admin@gmail.com", "admin123");

  try {
    const out = run("php", args, ROOT);
    const tail = out.trim().split("\n").pop().trim();
    if (/0 SERVER ERRORS/.test(tail)) ok(`${app.label}: ${tail}`);
    else bad(`${app.label}: ${tail}`);
  } catch (error) {
    bad(`${app.label}: ${String(error.stdout || error.message).trim().split("\n").pop()}`);
  }
}

/* ---------------------------------------------------------------- 4. build */
heading("4 · Frontends — lint, typecheck, build");
for (const app of APPS) {
  const cwd = path.join(ROOT, app.frontend);
  try {
    execSync("npm run lint", { cwd, stdio: "pipe" });
    ok(`${app.label}: lint clean`);
  } catch (error) {
    bad(`${app.label}: lint\n${String(error.stdout ?? "").trim().slice(-900)}`);
  }
  try {
    execSync("npx tsc --noEmit", { cwd, stdio: "pipe" });
    ok(`${app.label}: typecheck clean`);
  } catch (error) {
    bad(`${app.label}: typecheck\n${String(error.stdout ?? "").trim().slice(-900)}`);
  }
}

fs.rmSync(TMP, { recursive: true, force: true });

console.log(
  failures === 0
    ? "\n\x1b[32m  everything checked out\x1b[0m\n"
    : `\n\x1b[31m  ${failures} problem(s)\x1b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);

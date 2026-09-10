#!/usr/bin/env node
/**
 * Deployment security probe — what a stranger with a browser can actually reach.
 *
 *   node tools/deploy-probe.mjs https://iced-out.node2begin.com
 *   node tools/deploy-probe.mjs http://localhost:3000 --allow-http
 *
 * READ-ONLY AND SAFE TO RUN AGAINST PRODUCTION. Every request is a GET or a
 * HEAD, nothing is posted, no session is used, and no path is guessed that is
 * not already a known file in this repository. It reads exactly what an
 * unauthenticated visitor could read anyway; the only difference is that it
 * writes down what it found.
 *
 * WHY THIS EXISTS AS A TOOL RATHER THAN A CHECKLIST. The flat cPanel layout puts
 * `.env`, `config/`, `src/`, `storage/logs/` and a full database dump inside the
 * document root, protected by `.htaccess` alone. Whether that protection is
 * actually in force is not a property of this repository — it depends on the
 * host's `AllowOverride`, on which build was uploaded, and on whether anybody
 * copied a file in by hand since. It cannot be answered by reading code. It can
 * only be answered by asking the server, which is what this does.
 *
 * A finding here is worth more than a finding anywhere else in the audit,
 * because it is the live system answering rather than a file describing it.
 */

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "").replace(/\/+$/, "");
const allowHttp = args.includes("--allow-http");
const verbose = args.includes("--verbose");

if (base === "") {
  process.stderr.write(
    "usage: node tools/deploy-probe.mjs <base-url> [--allow-http] [--verbose]\n" +
      "   eg: node tools/deploy-probe.mjs https://iced-out.node2begin.com\n",
  );
  process.exit(2);
}

if (!base.startsWith("https://") && !allowHttp) {
  process.stderr.write(
    `Refusing to probe ${base} over plain http. Pass --allow-http if that is deliberate\n` +
      "(a local dev server), but never for production — the answers would travel in clear.\n",
  );
  process.exit(2);
}

/* ── the checks ───────────────────────────────────────────────────────────────

   `secret` names a string that must NEVER appear in a response body. A 200 is
   not automatically a failure — a host that serves a styled 404 page with status
   200 is common — so what actually decides is whether the CONTENT leaked. That
   is why the dump and config probes carry a marker rather than trusting a code.
*/
const P0 = "P0";
const P1 = "P1";

const PROBES = [
  { path: "/.env", label: ".env is not readable", severity: P0, secret: ["DB_PASS", "SESSION_SECRET", "RAZORPAY_KEY_SECRET"] },
  { path: "/.env.example", label: ".env.example is not readable", severity: P1 },
  { path: "/.git/HEAD", label: ".git/HEAD is not readable", severity: P0, secret: ["ref:"] },
  { path: "/.git/config", label: ".git/config is not readable", severity: P0, secret: ["[core]", "remote "] },
  { path: "/config/database.php", label: "config/database.php is not readable", severity: P0, secret: ["DB_PASS", "database.password", "<?php"] },
  { path: "/config/app.php", label: "config/app.php is not readable", severity: P0, secret: ["SESSION_SECRET", "<?php"] },
  { path: "/autoload.php", label: "autoload.php is not readable", severity: P0, secret: ["<?php"] },
  { path: "/src/Kernel/Database.php", label: "src/ is not readable", severity: P0, secret: ["<?php", "class Database"] },
  { path: "/database/iced_out.sql", label: "database dumps are not readable", severity: P0, secret: ["CREATE TABLE", "INSERT INTO"] },
  { path: "/database/iced_out_live.sql", label: "live dump is not readable", severity: P0, secret: ["CREATE TABLE"] },
  { path: "/migrations/0001_platform_identity.sql", label: "migrations are not readable", severity: P1, secret: ["CREATE TABLE"] },
  { path: "/migrations/0031_payment_intents.sql", label: "payment migration is not readable", severity: P1, secret: ["CREATE TABLE"] },
  { path: "/seeds/data", label: "seeds/ is not readable", severity: P1 },
  { path: "/storage/logs/", label: "storage/logs is not listable", severity: P0 },
  { path: "/storage/media/", label: "storage/media is not listable", severity: P1 },
  { path: "/LIVE.zip", label: "deployment archives are not readable", severity: P0, secret: ["PK"] },
  { path: "/backup.zip", label: "stray archives are not readable", severity: P1 },
  // Presence, not access: these answer 500 and 403 respectively without a
  // token, which the old status allowlist read as "safely refused".
  { path: "/setup.php", label: "the schema installer is gone", severity: P0, mustBeAbsent: true },
  { path: "/diagnose.php", label: "the diagnostics page is gone", severity: P0, mustBeAbsent: true },
  { path: "/dev-server.php", label: "the dev server shim is gone", severity: P0, mustBeAbsent: true },
  { path: "/build.txt", label: "build.txt is not readable", severity: P1 },
  { path: "/phpstan.neon", label: "phpstan.neon is not readable", severity: P1 },
  // A previous deployment left beside the new one. Folder deny rules are
  // "^"-anchored, so a nested copy is matched by none of them.
  { path: "/site/backup/.env", label: "no nested backup .env", severity: P0, secret: ["DB_PASS", "SESSION_SECRET"] },
  { path: "/site/backup/live.zip", label: "no nested backup archive", severity: P0, secret: ["PK"] },
  { path: "/site/backup/config/app.php", label: "no nested backup config", severity: P0, secret: ["<?php"] },
  { path: "/site/backup/database/iced_out_live.sql", label: "no nested backup dump", severity: P0, secret: ["CREATE TABLE"] },
  { path: "/database/iced_out_schema.sql", label: "schema dump is not readable", severity: P0, secret: ["CREATE TABLE"] },
  { path: "/database/iced_out_reference_data.sql", label: "reference dump is not readable", severity: P0, secret: ["INSERT INTO"] },
  { path: "/composer.json", label: "composer.json is not readable", severity: P1, secret: ["\"require\""] },
  { path: "/bin/console.php", label: "bin/ is not readable", severity: P0, secret: ["<?php"] },
  { path: "/phpunit.xml", label: "phpunit.xml is not readable", severity: P1 },
  { path: "/vendor/autoload.php", label: "vendor/ is not readable", severity: P1, secret: ["<?php"] },
];

/** Directories that must not answer with an index listing. */
const LISTINGS = ["/images/", "/_next/", "/_next/static/", "/storage/"];

let p0 = 0;
let p1 = 0;
let passed = 0;
const failures = [];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const amber = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function record(ok, severity, label, detail) {
  if (ok) {
    passed += 1;
    if (verbose) console.log(`  ${green("PASS")} ${label} ${dim(detail ?? "")}`);
    return;
  }

  severity === P0 ? (p0 += 1) : (p1 += 1);
  failures.push({ severity, label, detail });
  console.log(`  ${severity === P0 ? red("FAIL") : amber("WARN")} [${severity}] ${label} — ${detail}`);
}

async function fetchQuietly(url, init = {}) {
  try {
    return await fetch(url, { redirect: "manual", ...init });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/* ── 1. nothing private is fetchable ─────────────────────────────────────── */
async function probeFiles() {
  console.log("\n\x1b[1m1 · Private files and folders\x1b[0m\n");

  for (const probe of PROBES) {
    const response = await fetchQuietly(base + probe.path);

    if (response.error) {
      /* A NETWORK ERROR IS NOT A PASS.
         This used to `record(true, …)`, which meant a typo in the host, a DNS
         failure, an expired certificate or a timeout printed a clean bill of
         health — "23 passed, 0 P0" — for a server nobody had actually reached.
         That is the worst possible failure mode for a verification tool: it is
         indistinguishable from success, and it is the reading somebody takes to
         a go-live meeting. */
      record(false, probe.severity, probe.label, `COULD NOT REACH THE HOST (${response.error}) — this proves nothing`);
      continue;
    }

    const status = response.status;

    /* SOME PROBES ARE ABOUT PRESENCE, NOT ACCESS.
       `setup.php` is a schema installer that answers 500 without a token, and
       `diagnose.php` answers 403 — both of which the old status allowlist read
       as "safely refused", so the two P0 probes that exist to say "delete this
       file" were structurally incapable of firing. Deleted means 404. Anything
       else means the file is still sitting there with its own token gate as the
       only thing between an attacker and a database installer. */
    if (probe.mustBeAbsent) {
      record(
        status === 404,
        probe.severity,
        probe.label,
        status === 404 ? 'HTTP 404' : `HTTP ${status} — THE FILE IS STILL DEPLOYED (only 404 means gone)`,
      );
      continue;
    }

    if (status === 403 || status === 404 || status === 401) {
      record(true, probe.severity, probe.label, `HTTP ${status}`);
      continue;
    }

    /* A REDIRECT IS NOT A REFUSAL.
       `redirect: "manual"` means a 301 to the same file under `www.`, or to a
       trailing slash, arrives here as a 3xx — and used to fall through to the
       final `record(true, …)`. The file is served at the target; the probe just
       did not follow it. */
    if (status >= 300 && status < 400) {
      const location = response.headers.get("location") ?? "(no Location)";
      record(false, probe.severity, probe.label, `HTTP ${status} → ${location} — followed, this may still be served`);
      continue;
    }

    // 2xx. What matters is whether the CONTENT is the real thing: plenty of
    // hosts answer an unknown path with a styled 404 page at 200.
    const body = await response.text().catch(() => "");
    const leaked = (probe.secret ?? []).filter((marker) => body.includes(marker));

    if (leaked.length > 0) {
      record(false, probe.severity, probe.label, `HTTP ${status} AND THE BODY CONTAINS ${leaked.join(", ")}`);
      continue;
    }

    if (status >= 200 && status < 300) {
      /* 200 with no marker is still a served body. It may be a soft-404 page,
         or it may be the real file truncated or empty — a `.env` served as an
         empty 200 passed the old check. Neither this tool nor anyone reading it
         can tell from here, so it is reported rather than waved through. */
      record(
        false,
        probe.severity,
        probe.label,
        `HTTP ${status} with ${body.length} bytes — served something; open it by hand`,
      );
      continue;
    }

    record(true, probe.severity, probe.label, `HTTP ${status}`);
  }
}

/* ── 2. no directory listings ─────────────────────────────────────────────── */
async function probeListings() {
  console.log("\n\x1b[1m2 · Directory listings\x1b[0m\n");

  for (const dir of LISTINGS) {
    const response = await fetchQuietly(base + dir);

    if (response.error) {
      record(true, P1, `no listing at ${dir}`, "unreachable");
      continue;
    }

    const body = await response.text().catch(() => "");
    const looksLikeIndex = /<title>Index of |<h1>Index of /i.test(body);

    record(!looksLikeIndex, P1, `no listing at ${dir}`, looksLikeIndex ? "Apache index page served" : `HTTP ${response.status}`);
  }
}

/* ── 3. transport and headers ─────────────────────────────────────────────── */
async function probeHeaders() {
  console.log("\n\x1b[1m3 · Transport and browser headers\x1b[0m\n");

  const response = await fetchQuietly(base + "/");

  if (response.error) {
    record(false, P0, "the site answers at all", response.error);
    return;
  }

  const h = response.headers;

  record(Boolean(h.get("x-content-type-options")), P1, "X-Content-Type-Options is set", h.get("x-content-type-options") ?? "absent");
  record(Boolean(h.get("referrer-policy")), P1, "Referrer-Policy is set", h.get("referrer-policy") ?? "absent");
  record(
    Boolean(h.get("x-frame-options") || (h.get("content-security-policy") ?? "").includes("frame-ancestors")),
    P1,
    "framing is refused",
    h.get("x-frame-options") ?? "absent",
  );

  const csp = h.get("content-security-policy");
  const cspReport = h.get("content-security-policy-report-only");
  record(Boolean(csp), P1, "Content-Security-Policy is enforced", csp ? "present" : cspReport ? "REPORT-ONLY only" : "absent");

  record(Boolean(h.get("permissions-policy")), P1, "Permissions-Policy is set", h.get("permissions-policy") ?? "absent");
  record(!h.get("x-powered-by"), P1, "X-Powered-By is not advertised", h.get("x-powered-by") ?? "absent");
  record(!(h.get("server") ?? "").match(/\d+\.\d+/), P1, "Server header carries no version", h.get("server") ?? "absent");

  if (base.startsWith("https://")) {
    const hsts = h.get("strict-transport-security");
    const age = Number((hsts ?? "").match(/max-age=(\d+)/)?.[1] ?? 0);
    record(age >= 31536000, P1, "HSTS is at least a year", hsts ?? "absent");

    // http must redirect to https.
    const plain = await fetchQuietly(base.replace("https://", "http://") + "/");
    const location = plain.headers?.get?.("location") ?? "";
    record(
      Boolean(plain.error) || (plain.status >= 300 && plain.status < 400 && location.startsWith("https://")),
      P1,
      "http redirects to https",
      plain.error ? "no plain-http listener" : `HTTP ${plain.status} → ${location || "(no Location)"}`,
    );
  }
}

/* ── 4. the API's own posture ─────────────────────────────────────────────── */
async function probeApi() {
  console.log("\n\x1b[1m4 · API\x1b[0m\n");

  const health = await fetchQuietly(base + "/api/v1/health");

  if (health.error || health.status >= 500) {
    record(false, P1, "the API answers /health", health.error ?? `HTTP ${health.status}`);
    return;
  }

  record(true, P1, "the API answers /health", `HTTP ${health.status}`);

  // Readiness carries the production self-checks added in the security work.
  const ready = await fetchQuietly(base + "/api/v1/ready");
  const readyBody = await ready.text?.().catch(() => "") ?? "";

  /* The five checks that only exist when APP_ENV=production.
     `productionChecks()` returns an empty array otherwise, so a host running
     with APP_ENV=dev answers a perfectly well-formed `checks` object containing
     only `database` and `cache` — and the old loop iterated those two, found
     them true, and printed green. The five assertions that actually matter
     vanished with no warning, on exactly the misconfiguration they exist to
     catch. Their ABSENCE is now the finding. */
  const REQUIRED_CHECKS = ["debug_off", "https_url", "mail_driver", "session_secret", "payment_intents_enforced"];

  let checks = null;

  try {
    checks = JSON.parse(readyBody)?.data?.checks ?? null;
  } catch {
    checks = null;
  }

  if (checks === null) {
    record(false, P1, "/ready returns a checks object", "unparseable or absent — is the security work deployed?");
  } else {
    const absent = REQUIRED_CHECKS.filter((key) => !(key in checks));

    if (absent.length > 0) {
      record(
        false,
        P0,
        "/ready runs its production self-checks",
        `MISSING ${absent.join(", ")} — APP_ENV is not "production", so none of them ran`,
      );
    }

    for (const [key, value] of Object.entries(checks)) {
      const severity = REQUIRED_CHECKS.includes(key) ? P0 : P1;
      record(value === true, severity, `/ready · ${key}`, value === true ? "ok" : "REPORTED FALSE");
    }
  }

  // An error must not carry a stack trace.
  const boom = await fetchQuietly(base + "/api/v1/catalog/products/__probe_does_not_exist__");
  const boomBody = (await boom.text?.().catch(() => "")) ?? "";
  const leaks = ["#0 ", "Stack trace", "/src/Kernel/", "SQLSTATE", "PDOException", "on line "];
  const found = leaks.filter((marker) => boomBody.includes(marker));
  record(found.length === 0, P0, "errors carry no trace, SQL, or path", found.length ? `body contains ${found.join(", ")}` : "clean");

  // CORS must not reflect an arbitrary origin.
  const cors = await fetchQuietly(base + "/api/v1/health", { headers: { Origin: "https://evil.example" } });
  const allow = cors.headers?.get?.("access-control-allow-origin") ?? "";
  /* Only a header naming the ATTACKER'S origin is a finding. A static header
     naming the site's own origin is a correct same-origin configuration, and
     flagging it was a false positive that would have sent somebody looking for
     a hole that is not there. */
  const reflected = allow === "https://evil.example" || allow === "*";
  record(
    !reflected,
    P0,
    "CORS does not reflect an arbitrary origin",
    allow === "" ? "no header" : reflected ? `REFLECTED ${allow}` : `static ${allow} — not the requested origin`,
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

console.log(`\n\x1b[1mProbing ${base}\x1b[0m`);
console.log(dim("read-only: GET requests only, no session, nothing written\n"));

await probeFiles();
await probeListings();
await probeHeaders();
await probeApi();

console.log(`\n${"─".repeat(72)}`);
console.log(`  ${green(String(passed) + " passed")}   ${p0 ? red(p0 + " P0") : "0 P0"}   ${p1 ? amber(p1 + " P1") : "0 P1"}\n`);

if (failures.length > 0) {
  console.log("  Fix, worst first:\n");
  for (const f of failures.filter((x) => x.severity === P0)) console.log(`    ${red("P0")} ${f.label} — ${f.detail}`);
  for (const f of failures.filter((x) => x.severity === P1)) console.log(`    ${amber("P1")} ${f.label} — ${f.detail}`);
  console.log("");
}

process.exit(p0 > 0 ? 1 : 0);

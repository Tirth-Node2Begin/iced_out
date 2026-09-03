/**
 * Builds `<backend>/database/iced_out_live.sql` — one file that creates the whole
 * live database in a single phpMyAdmin import.
 *
 * `<backend>` is `live/site` in the flat layout and `live/iced-out-api` in the
 * split one; this script probes for whichever build-live.mjs produced, by
 * looking for autoload.php + config/app.php.
 *
 *     node tools/live/build-database.mjs
 *     node tools/live/build-database.mjs --db=iced_out_build --user=root --pass=secret
 *     node tools/live/build-database.mjs --demo        add the fixture store too
 *     node tools/live/build-database.mjs --drop        remove the build database after
 *
 * Run it AFTER tools/live/build-live.mjs. It works by building a real database
 * on this machine — migrate, then seed — and dumping the result, because the
 * seeds are PHP that reads and writes rows; there is no honest way to produce
 * their output without running them.
 *
 * It deliberately builds into a throwaway database rather than dumping the one
 * you develop against, so the file never carries a test order, a customer who
 * registered while you were working, or a half-finished experiment.
 *
 * Two couplings the generated header repeats, because both are silent failures:
 *
 *   · The staff password hash is peppered with SESSION_SECRET (spec §14), and
 *     the seed runs against the bundle's own .env — so the dump only works
 *     alongside THAT .env. Re-mint the secret and the admin login stops.
 *   · Seeding writes 32 photographs into the bundle's storage/media and the
 *     matching media_assets rows into the dump. The two ship together or every
 *     product tile 404s.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
/**
 * The backend, wherever build-live.mjs put it: the flat layout leaves it in the
 * document root beside the site's files, the split layout puts it above. Probed
 * rather than configured, so this script has no --layout of its own to get wrong.
 */
const PRIVATE_CANDIDATES = [
  path.join(REPO, "live", "site"), //          flat  — backend beside the site's files
  path.join(REPO, "live", "iced-out-api"), //  split — backend above the document root
];

const isBackendRoot = (directory) =>
  existsSync(path.join(directory, "autoload.php")) && existsSync(path.join(directory, "config", "app.php"));

const PRIVATE = PRIVATE_CANDIDATES.find(isBackendRoot) ?? PRIVATE_CANDIDATES[0];

const OUT = path.join(PRIVATE, "database", "iced_out_live.sql");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;

const HOST = option("host", "127.0.0.1");
const PORT = option("port", "3306");
const USER = option("user", "root");
const PASS = option("pass", "");
const BUILD_DB = option("db", "iced_out_live");
const WITH_DEMO = flag("demo");
const DROP_AFTER = flag("drop");

const say = (line = "") => process.stdout.write(`${line}\n`);
const step = (line) => say(`\n\x1b[1m${line}\x1b[0m`);
const ok = (line) => say(`  \x1b[32m+\x1b[0m ${line}`);
const warn = (line) => say(`  \x1b[33m!\x1b[0m ${line}`);

/**
 * The database you develop against. Refused as a build target: this script runs
 * `migrate --fresh`, which drops every table, and the whole point of a separate
 * build database is that a mistyped flag cannot reach the one with your work in
 * it.
 */
const PROTECTED = new Set(["iced_out", "iced_out_test"]);

/** Where mysqldump.exe hides when it is not on PATH. */
const DUMP_CANDIDATES = [
  "mysqldump",
  "C:/xampp/mysql/bin/mysqldump.exe",
  "C:/wamp64/bin/mariadb/mariadb10.11.2/bin/mysqldump.exe",
  "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe",
  "C:/Program Files/MariaDB 11.4/bin/mysqldump.exe",
  "/usr/bin/mysqldump",
];

function findMysqldump() {
  for (const candidate of DUMP_CANDIDATES) {
    if (spawnSync(candidate, ["--version"]).status === 0) {
      return candidate;
    }
  }

  return null;
}

/** The console, run against the build database rather than whatever .env says. */
function console_(...argv) {
  return spawnSync("php", ["bin/console.php", ...argv], {
    cwd: PRIVATE,
    encoding: "utf8",
    env: { ...process.env, DB_HOST: HOST, DB_PORT: PORT, DB_NAME: BUILD_DB, DB_USER: USER, DB_PASS: PASS },
  });
}

/** One-off SQL through PHP's PDO, so no mysql client binary is needed. */
function query(sql, database = BUILD_DB) {
  const script = [
    '$dsn = "mysql:host=" . $_SERVER["H"] . ";port=" . $_SERVER["P"]',
    '     . ($_SERVER["N"] === "" ? "" : ";dbname=" . $_SERVER["N"]) . ";charset=utf8mb4";',
    '$pdo = new PDO($dsn, $_SERVER["U"], $_SERVER["W"], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);',
    '$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_NUM);',
    '$rows = $pdo->query($_SERVER["Q"]);',
    'if ($rows !== false) { foreach ($rows as $row) { echo implode("\\t", array_map("strval", $row)), "\\n"; } }',
  ].join("\n");

  const result = spawnSync("php", ["-r", script], {
    encoding: "utf8",
    env: { ...process.env, H: HOST, P: PORT, N: database, U: USER, W: PASS, Q: sql },
  });

  if (result.status !== 0) {
    throw new Error(`SQL failed: ${sql}\n${result.stderr.trim()}`);
  }

  return result.stdout.trim();
}

/**
 * Strips what a shared host will not accept.
 *
 * DEFINER is the one that actually bites: mysqldump stamps every view with the
 * account that created it (`root`@`127.0.0.1`), and importing that as a cPanel
 * user fails with "access denied; you need SUPER privileges" — halfway through,
 * leaving a part-built database. SQL SECURITY INVOKER runs the view as whoever
 * queries it, which is what a single-user database wants anyway.
 */
function portable(sql, meta) {
  let text = sql;

  text = text.replace(/\/\*!5001[0-9] DEFINER=[^*]*\*\//g, "/*!50013 SQL SECURITY INVOKER */");
  text = text.replace(/CREATE DEFINER=`[^`]*`@`[^`]*` /g, "CREATE ");

  /**
   * Views, rewritten as plain statements.
   *
   * mysqldump hides every view behind `/*!50001 ... *\/` version-conditional
   * comments. The server executes those, but an importer that filters comments
   * before sending — phpMyAdmin among them — drops them silently, and you end up
   * with all 88 tables, no views, and no error to say so. The console's queue
   * counts and `v_variant_availability` simply return "table doesn't exist"
   * later, a long way from the import that caused it.
   *
   * The three-line shape mysqldump emits is:
   *
   *     /*!50001 CREATE ALGORITHM=UNDEFINED *\/
   *     /*!50013 SQL SECURITY INVOKER *\/
   *     /*!50001 VIEW `v_x` AS select ... *\/;
   *
   * which becomes one CREATE OR REPLACE VIEW that any importer will run.
   */
  text = text.replace(
    /\/\*!50001 CREATE ALGORITHM=([^*]*?)\*\/\s*\/\*!50013 SQL SECURITY (\w+) \*\/\s*\/\*!50001 VIEW ([\s\S]*?)\*\/;/g,
    (_match, algorithm, security, body) =>
      `CREATE OR REPLACE ALGORITHM=${algorithm.trim()} SQL SECURITY ${security} VIEW ${body.trim()};`,
  );

  /* The placeholder view mysqldump writes first, so later views can reference
     it. Same comment problem, same treatment. */
  text = text.replace(
    /\/\*!50001 CREATE VIEW (`[^`]+` AS SELECT[\s\S]*?)\*\/;/g,
    (_match, body) => `CREATE OR REPLACE VIEW ${body.trim()};`,
  );

  /* mysqldump's own header names the build database, which is not the database
     this is going to be imported into. Replaced with something that says what
     the file is and how to use it. */
  text = text.replace(/^(--[^\n]*\n)+/, "");
  text = text.replace(/\n-- Dump completed on[^\n]*\n?$/, "\n");

  const header = [
    "-- ---------------------------------------------------------------------------",
    "-- Iced_out — the complete live database, in one file.",
    "--",
    `-- Generated ${meta.generatedAt} by tools/live/build-database.mjs`,
    `-- ${meta.tables} tables, ${meta.views} views.`,
    "--",
    "-- Starting data, and nothing else:",
    `--   ${meta.roles} roles, ${meta.permissions} permissions, ${meta.settings} store settings`,
    `--   ${meta.products} products, ${meta.variants} variants, ${meta.stock} stock items, ${meta.warehouses} warehouses`,
    `--   ${meta.media} product photographs, ${meta.users} staff account`,
    `--   ${meta.orders} orders, ${meta.customersLine}`,
    "--",
    "-- HOW TO IMPORT (cPanel)",
    "--   phpMyAdmin -> select YOUR database in the left column -> Import ->",
    "--   choose this file -> Go.",
    "--",
    "--   There is deliberately no CREATE DATABASE and no USE statement, so the",
    "--   dump lands in whichever database you have selected. Create the database",
    "--   in cPanel -> MySQL Databases first.",
    "--",
    "-- TWO THINGS THAT FAIL SILENTLY IF YOU MISS THEM",
    "--",
    "--   1. The staff password hash is peppered with SESSION_SECRET. It verifies",
    "--      ONLY against the SESSION_SECRET in the iced-out-api/.env that shipped",
    "--      beside this file. Re-mint that value and the admin login stops working",
    "--      with no other symptom.",
    "--",
    "--   2. The media_assets rows point at files under storage/media. Upload",
    "--      iced-out-api/storage/media along with everything else or every product",
    "--      photo 404s while the pages themselves look fine.",
    "--",
    "-- Re-importing is safe: every table is dropped and recreated. It also throws",
    "-- away anything the live site has recorded since the last import, so do it",
    "-- once, before the site takes traffic.",
    "-- ---------------------------------------------------------------------------",
    "",
  ].join("\n");

  /**
   * Session settings, stated as PLAIN statements.
   *
   * mysqldump already emits these, but wrapped in version-conditional comments
   * of the `/*!40014 ... *\/` form. The mysql CLI executes those; phpMyAdmin's
   * importer treats them as comments and skips them — and the import then dies
   * on the first table that points at one dumped later.
   *
   * It always dies on `carts`, because mysqldump writes tables alphabetically:
   * `carts` has a foreign key to `users`, which is 2,600 lines further down and
   * does not exist yet. With the checks off that is fine and normal — every
   * mysqldump restore depends on it. With them on it is `#1215 Cannot add
   * foreign key constraint`, and the cause looks nothing like the symptom.
   *
   * Written plainly here so that no importer can mistake them for comments.
   */
  const prologue = [
    "SET NAMES utf8mb4;",
    "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
    "SET time_zone = '+00:00';",
    "-- Off for the whole import: tables are created in alphabetical order, so a",
    "-- table is routinely created before the one it references. Restored at the end.",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "",
    ...(meta.drops.length > 0
      ? [
          "-- Everything is dropped up front, before anything is created.",
          "--",
          "-- mysqldump's own DROP sits immediately above each CREATE, which is too",
          "-- late: a failed earlier import can leave `users` behind as a MyISAM",
          "-- table, and MyISAM cannot be the target of a foreign key. `carts` is",
          "-- created long before `users` is reached and dropped, so it fails against",
          "-- the stale one. Clearing the database first removes that possibility.",
          ...meta.drops,
          "",
        ]
      : []),
  ].join("\n");

  const epilogue = ["", "SET FOREIGN_KEY_CHECKS = 1;", ""].join("\n");

  return header + prologue + text + epilogue;
}

async function main() {
  say(`\x1b[1mIced_out — live database\x1b[0m  →  build in \`${BUILD_DB}\` on ${HOST}:${PORT}`);

  if (PROTECTED.has(BUILD_DB)) {
    throw new Error(
      `Refusing to build into \`${BUILD_DB}\` — this script runs \`migrate --fresh\`, which drops every ` +
        `table. Pick another name with --db=`,
    );
  }

  try {
    await fs.access(path.join(PRIVATE, "autoload.php"));
  } catch {
    throw new Error(
      "No backend found at live/site or live/iced-out-api. " +
        "Run `node tools/live/build-live.mjs` first.",
    );
  }

  const mysqldump = findMysqldump();

  if (mysqldump === null) {
    throw new Error(
      `mysqldump was not found. Add it to PATH, or edit DUMP_CANDIDATES in ${path.relative(REPO, fileURLToPath(import.meta.url))}.`,
    );
  }

  step("Building the database");

  const created = console_("db:create");

  if (created.status !== 0) {
    throw new Error(`db:create failed.\n${created.stdout}${created.stderr}`);
  }

  ok(created.stdout.trim().split("\n").pop());

  /**
   * --fresh, so a re-run is a clean build rather than a migration on top of the
   * last one. The build database exists for exactly this and holds nothing else.
   */
  const migrated = console_("migrate", "--fresh");

  if (migrated.status !== 0) {
    throw new Error(`migrate failed.\n${migrated.stdout}${migrated.stderr}`);
  }

  ok(migrated.stdout.trim().split("\n").pop());

  /**
   * The photographs are rebuilt with the rows that name them, so the folder
   * starts empty. Without this every run leaves the previous run's 32 files
   * behind under fresh random keys — orphans that nothing references, that
   * nothing will ever clean up, and that get uploaded to the server anyway.
   */
  const media = path.join(PRIVATE, "storage", "media");
  await fs.rm(media, { recursive: true, force: true });
  await fs.mkdir(media, { recursive: true });
  await fs.writeFile(path.join(media, ".gitkeep"), "");

  const seeded = WITH_DEMO ? console_("seed", "--demo") : console_("seed");

  if (seeded.status !== 0) {
    throw new Error(`seed failed.\n${seeded.stdout}${seeded.stderr}`);
  }

  for (const line of seeded.stdout.trim().split("\n").slice(1)) {
    ok(line.replace(/^\s*\+\s*/, ""));
  }

  if (WITH_DEMO) {
    warn("--demo: the dump will carry fixture orders, customers and trading figures");
  }

  step("Dumping");

  const count = (sql) => Number(query(sql).split("\t")[0] ?? 0);

  const meta = {
    generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
    tables: count(
      `SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${BUILD_DB}' AND TABLE_TYPE='BASE TABLE'`,
    ),
    views: count(`SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA='${BUILD_DB}'`),
    roles: count("SELECT COUNT(*) FROM roles"),
    permissions: count("SELECT COUNT(*) FROM permissions"),
    settings: count("SELECT COUNT(*) FROM store_settings"),
    products: count("SELECT COUNT(*) FROM products"),
    variants: count("SELECT COUNT(*) FROM product_variants"),
    stock: count("SELECT COUNT(*) FROM stock_items"),
    warehouses: count("SELECT COUNT(*) FROM warehouses"),
    media: count("SELECT COUNT(*) FROM media_assets"),
    users: count("SELECT COUNT(*) FROM users"),
    orders: count("SELECT COUNT(*) FROM orders"),
  };

  meta.customersLine = `${count("SELECT COUNT(*) FROM user_addresses")} saved addresses`;

  /**
   * The upfront DROP block. Views first — a view over a table that is about to
   * be dropped is not something MySQL will let you leave lying around, and a
   * stale view of the same name as a table is its own class of confusion.
   */
  const views = query(
    `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA='${BUILD_DB}' ORDER BY TABLE_NAME`,
  )
    .split("\n")
    .filter((name) => name !== "");

  const tables = query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${BUILD_DB}' ` +
      `AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`,
  )
    .split("\n")
    .filter((name) => name !== "");

  meta.drops = [
    ...views.map((name) => `DROP VIEW IF EXISTS \`${name}\`;`),
    ...tables.map((name) => `DROP TABLE IF EXISTS \`${name}\`;`),
  ];

  const dumped = spawnSync(
    mysqldump,
    [
      `--host=${HOST}`,
      `--port=${PORT}`,
      `--user=${USER}`,
      ...(PASS === "" ? [] : [`--password=${PASS}`]),
      "--default-character-set=utf8mb4",
      "--single-transaction",
      "--quick",
      "--hex-blob",
      "--add-drop-table",
      "--complete-insert",
      "--skip-add-locks",
      "--routines",
      "--triggers",
      BUILD_DB,
    ],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
  );

  if (dumped.status !== 0) {
    throw new Error(`mysqldump failed.\n${dumped.stderr}`);
  }

  const sql = portable(dumped.stdout, meta);

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, sql, "utf8");

  ok(`${path.relative(REPO, OUT)} — ${(Buffer.byteLength(sql) / 1024).toFixed(0)} KB`);
  ok(`${meta.tables} tables, ${meta.views} views, ${meta.products} products, ${meta.media} photographs`);

  const photos = (await fs.readdir(media, { recursive: true })).filter((f) => /\.(webp|jpe?g|png|avif)$/i.test(f));

  if (photos.length < meta.media) {
    warn(`storage/media holds ${photos.length} files but the dump references ${meta.media}`);
  } else {
    ok(`storage/media — ${photos.length} files, matching the dump`);
  }

  if (DROP_AFTER) {
    query(`DROP DATABASE \`${BUILD_DB}\``, "");
    ok(`dropped the build database \`${BUILD_DB}\``);
  }

  step("Done");
  say(`  Import this into the live database:  ${path.relative(REPO, OUT).split("\\").join("/")}`);
  say(`  Then step 5 of DEPLOY.md (setup.php) is unnecessary — delete setup.php instead.`);
  say("");
  }

main().catch((error) => {
  say(`\n\x1b[31m✗ ${error.message}\x1b[0m\n`);
  process.exitCode = 1;
});

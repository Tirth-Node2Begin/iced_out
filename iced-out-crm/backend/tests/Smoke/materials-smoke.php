<?php

declare(strict_types=1);

/**
 * The raw-material flow, driven end to end through the real pipeline.
 *
 * It walks the whole chain and checks the numbers at every hop:
 *
 *   supplier → purchase → order → PARTIAL receipt → full receipt
 *           → recipe (BOM) → run planned → started (materials held)
 *           → completed with a SHORT yield → finished units in stock
 *
 * The short yield is the interesting case: a run of 10 that makes 8 must
 * consume material for 8, give the other two units' worth back, and add 8
 * pieces — not 10. That is the arithmetic most easily got wrong, so it is what
 * this test is built around.
 *
 * Every record it writes is removed on the way out.
 *
 *   php tests/Smoke/materials-smoke.php
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Json;

$app = Application::boot($root);
$db = $app->container->make(Database::class);
$cookies = [];
$pass = 0;
$fail = 0;

function absorb(Response $r, array &$cookies): void
{
    $header = $r->headers()['Set-Cookie'] ?? null;
    if (!is_string($header) || preg_match('/^([^=]+)=([^;]*)/', $header, $m) !== 1) {
        return;
    }
    $name = trim($m[1]);
    if (trim($m[2]) === '' || str_contains($header, 'Max-Age=0')) {
        unset($cookies[$name]);

        return;
    }
    $cookies[$name] = trim($m[2]);
}

function call(string $method, string $path, ?array $body = null): array
{
    global $app, $cookies;
    $headers = ['x-client-audience' => 'admin', 'origin' => 'http://127.0.0.1:8100'];
    $raw = '';
    if ($body !== null) {
        $headers['content-type'] = 'application/json';
        $raw = Json::encode($body);
    }
    $query = [];
    if (str_contains($path, '?')) {
        [$path, $qs] = explode('?', $path, 2);
        parse_str($qs, $query);
    }
    $res = $app->handle(new Request(
        method: $method, path: $path, query: $query, headers: $headers,
        cookies: $cookies, rawBody: $raw, ip: '127.0.0.1',
    ));
    absorb($res, $cookies);

    return [$res->status(), Json::decodeArray($res->body()) ?? []];
}

function check(string $label, bool $ok, string $note = ''): void
{
    global $pass, $fail;
    if ($ok) {
        ++$pass;
        printf("  ok    %s%s\n", $label, $note === '' ? '' : "  ($note)");
    } else {
        ++$fail;
        printf("  FAIL  %s%s\n", $label, $note === '' ? '' : "  ($note)");
    }
}

/* ------------------------------------------------------------------ sign in */
[$s] = call('POST', '/admin/auth/login', ['email' => 'admin@gmail.com', 'password' => 'admin123']);
if ($s !== 200) {
    fwrite(STDERR, "  cannot sign in ($s) — is the database seeded?\n");
    exit(1);
}

/* ----------------------------------------------------------------- supplier */
[$s, $b] = call('POST', '/admin/inventory/suppliers', [
    'name' => 'Smoke Mills',
    'contactName' => 'R. Iyer',
    'email' => 'sales@smokemills.example',
    'leadTimeDays' => 14,
]);
check('create supplier', $s === 201, "got $s " . ($s !== 201 ? Json::encode($b) : ''));
$supplier = $b['data']['supplier']['id'] ?? '';
check('  → lead time reads in words', ($b['data']['supplier']['leadTime'] ?? '') === '14 days');

[$s] = call('POST', '/admin/inventory/suppliers', ['name' => 'Smoke Mills']);
check('duplicate supplier name refused', $s === 409, "got $s");

/* ---------------------------------------------------------------- materials */
[$s, $b] = call('POST', '/admin/inventory/materials', [
    'name' => 'Smoke Fleece 520gsm',
    'code' => 'SMK-FLC-520',
    'kind' => 'FABRIC',
    'unit' => 'M',
    'reorderPoint' => 20,
    'unitCost' => 640,
    'supplier' => $supplier,
]);
check('create material', $s === 201, "got $s " . ($s !== 201 ? Json::encode($b) : ''));
$fleece = $b['data']['material']['id'] ?? '';
check('  → starts empty', ($b['data']['material']['onHand'] ?? '') === '0', (string) ($b['data']['material']['onHand'] ?? ''));
check('  → and reads as Out', ($b['data']['material']['state'] ?? '') === 'Out', (string) ($b['data']['material']['state'] ?? ''));

[$s, $b] = call('POST', '/admin/inventory/materials', [
    'name' => 'Smoke Drawcord',
    'kind' => 'TRIM', 'unit' => 'M', 'reorderPoint' => 50, 'unitCost' => 12, 'supplier' => $supplier,
]);
$cord = $b['data']['material']['id'] ?? '';
check('create second material', $s === 201, $cord);

/* ---------------------------------------------------------------- purchase */
[$s, $b] = call('POST', '/admin/inventory/purchases', ['supplier' => $supplier, 'expectedOn' => '2026-09-30']);
check('create purchase', $s === 201, "got $s");
$po = $b['data']['purchase']['id'] ?? '';
check('  → opens as a draft', ($b['data']['purchase']['status'] ?? '') === 'DRAFT');

[$s] = call('POST', "/admin/inventory/purchases/$po/receive", ['lines' => [['material' => $fleece, 'qty' => 10]]]);
check('a DRAFT cannot receive stock', $s === 409, "got $s");

[$s, $b] = call('PUT', "/admin/inventory/purchases/$po/lines", ['lines' => [
    ['material' => $fleece, 'qty' => 120, 'unitCost' => 640],
    ['material' => $cord, 'qty' => 200, 'unitCost' => 12],
]]);
check('set purchase lines', $s === 200 && count($b['data']['lines'] ?? []) === 2, "got $s");
check('  → line total costed', ($b['data']['purchase']['totalCost'] ?? '') === '₹79,200',
    (string) ($b['data']['purchase']['totalCost'] ?? ''));

[$s, $b] = call('POST', "/admin/inventory/purchases/$po/transition", ['to' => 'order']);
check('order it', $s === 200 && ($b['data']['purchase']['status'] ?? '') === 'ORDERED', "got $s");

/* A SHORT delivery: 100 of the 120 metres. */
[$s, $b] = call('POST', "/admin/inventory/purchases/$po/receive", ['lines' => [
    ['material' => $fleece, 'qty' => 100],
    ['material' => $cord, 'qty' => 200],
]]);
check('partial receipt', $s === 200, "got $s " . ($s !== 200 ? Json::encode($b) : ''));
check('  → purchase sits at PARTIAL', ($b['data']['purchase']['status'] ?? '') === 'PARTIAL',
    (string) ($b['data']['purchase']['status'] ?? ''));
$fleeceLine = null;
foreach ($b['data']['lines'] ?? [] as $line) {
    if (($line['materialId'] ?? '') === $fleece) {
        $fleeceLine = $line;
    }
}
check('  → 20 m still outstanding', ($fleeceLine['outstanding'] ?? '') === '20', (string) ($fleeceLine['outstanding'] ?? ''));

[$s, $b] = call('GET', "/admin/inventory/materials/$fleece");
check('material now holds the receipt', ($b['data']['material']['onHand'] ?? '') === '100',
    (string) ($b['data']['material']['onHand'] ?? ''));
check('  → and reads as Healthy', ($b['data']['material']['state'] ?? '') === 'Healthy');
check('  → the ledger recorded it', count($b['data']['movements'] ?? []) === 1
    && ($b['data']['movements'][0]['type'] ?? '') === 'RECEIPT');

/* The rest of the delivery closes the purchase. */
[$s, $b] = call('POST', "/admin/inventory/purchases/$po/receive", ['lines' => [['material' => $fleece, 'qty' => 20]]]);
check('final receipt closes the purchase', ($b['data']['purchase']['status'] ?? '') === 'RECEIVED',
    (string) ($b['data']['purchase']['status'] ?? ''));

/* ------------------------------------------------------------------ recipe */
$item = $db->selectOne('SELECT public_id, item_name FROM stock_items WHERE deleted_at IS NULL ORDER BY id LIMIT 1');
if ($item === null) {
    fwrite(STDERR, "  no stock item to build a recipe on — seed the catalogue first\n");
    exit(1);
}
$itemId = (string) $item['public_id'];

[$s, $b] = call('PUT', "/admin/inventory/recipes/$itemId", ['lines' => [
    /* 2.4 m plus 5% cutting loss = 2.52 m per piece. */
    ['material' => $fleece, 'perUnit' => 2.4, 'wastagePct' => 5],
    ['material' => $cord, 'perUnit' => 1.2, 'wastagePct' => 0],
]]);
check('set the recipe', $s === 200 && count($b['data']['lines'] ?? []) === 2, "got $s " . ($s !== 200 ? Json::encode($b) : ''));
$fleeceRecipe = null;
foreach ($b['data']['lines'] ?? [] as $line) {
    if (($line['materialId'] ?? '') === $fleece) {
        $fleeceRecipe = $line;
    }
}
check('  → wastage folded into the effective quantity', ($fleeceRecipe['effective'] ?? '') === '2.52',
    (string) ($fleeceRecipe['effective'] ?? ''));
check('  → material cost per piece', ($b['data']['materialCost'] ?? '') === '₹1,627',
    (string) ($b['data']['materialCost'] ?? ''));

/* --------------------------------------------------------------------- run */
[$s, $b] = call('POST', '/admin/inventory/runs', ['item' => $itemId, 'qty' => 10]);
check('plan a run of 10', $s === 201, "got $s " . ($s !== 201 ? Json::encode($b) : ''));
$run = $b['data']['run']['id'] ?? '';
check('  → it froze the recipe', count($b['data']['lines'] ?? []) === 2);
check('  → and can start (enough of everything)', ($b['data']['canStart'] ?? false) === true);
$need = null;
foreach ($b['data']['lines'] ?? [] as $line) {
    if (($line['materialId'] ?? '') === $fleece) {
        $need = $line;
    }
}
check('  → needs 25.2 m of fleece', ($need['required'] ?? '') === '25.2', (string) ($need['required'] ?? ''));

[$s, $b] = call('POST', "/admin/inventory/runs/$run/transition", ['to' => 'start']);
check('start the run', $s === 200 && ($b['data']['run']['status'] ?? '') === 'STARTED', "got $s " . ($s !== 200 ? Json::encode($b) : ''));

[$s, $b] = call('GET', "/admin/inventory/materials/$fleece");
check('  → the fleece is now held', ($b['data']['material']['reserved'] ?? '') === '25.2',
    (string) ($b['data']['material']['reserved'] ?? ''));
check('  → on hand is untouched', ($b['data']['material']['onHand'] ?? '') === '120',
    (string) ($b['data']['material']['onHand'] ?? ''));
check('  → available came down', ($b['data']['material']['available'] ?? '') === '94.8',
    (string) ($b['data']['material']['available'] ?? ''));

$before = (int) ($db->selectOne('SELECT total_units FROM stock_items WHERE public_id = ?', [$itemId])['total_units'] ?? 0);

/* The run yields 8, not the 10 it planned. */
[$s, $b] = call('POST', "/admin/inventory/runs/$run/transition", ['to' => 'complete', 'produced' => 8]);
check('complete with a short yield', $s === 200 && ($b['data']['run']['status'] ?? '') === 'DONE', "got $s " . ($s !== 200 ? Json::encode($b) : ''));
check('  → records 8 produced', ($b['data']['run']['qtyProduced'] ?? 0) === 8);

[$s, $b] = call('GET', "/admin/inventory/materials/$fleece");
/* 8 × 2.52 = 20.16 consumed; 120 − 20.16 = 99.84 left, and nothing still held. */
check('  → consumed only what 8 needed', ($b['data']['material']['onHand'] ?? '') === '99.84',
    (string) ($b['data']['material']['onHand'] ?? ''));
check('  → and gave the rest of the hold back', ($b['data']['material']['reserved'] ?? '') === '0',
    (string) ($b['data']['material']['reserved'] ?? ''));

$after = (int) ($db->selectOne('SELECT total_units FROM stock_items WHERE public_id = ?', [$itemId])['total_units'] ?? 0);
check('finished units reached the warehouse', $after - $before === 8, sprintf('%d → %d', $before, $after));

[$s, $b] = call('GET', '/admin/inventory/runs');
check('run register lists it', $s === 200 && ($b['data']['summary']['unitsMade'] ?? 0) >= 8);

/* --------------------------------------------------------------- the guards */
[$s, $b] = call('POST', '/admin/inventory/runs', ['item' => $itemId, 'qty' => 100000]);
$bigRun = $b['data']['run']['id'] ?? '';
[$s2] = call('POST', "/admin/inventory/runs/$bigRun/transition", ['to' => 'start']);
check('a run bigger than stock cannot start', $s2 === 409, "got $s2");
call('DELETE', "/admin/inventory/runs/$bigRun");

[$s] = call('POST', "/admin/inventory/materials/$fleece/adjust", ['onHand' => 5, 'reason' => 'x']);
check('adjust needs a real reason', $s === 422, "got $s");

[$s, $b] = call('POST', "/admin/inventory/materials/$fleece/adjust", [
    'onHand' => 90, 'reason' => 'Stocktake after the smoke run',
]);
check('adjust with a reason works', $s === 200 && ($b['data']['material']['onHand'] ?? '') === '90',
    (string) ($b['data']['material']['onHand'] ?? ''));

[$s] = call('DELETE', "/admin/inventory/materials/$fleece");
check('a material on a recipe cannot be deleted', $s === 409, "got $s");

/* ----------------------------------------------------------------- cleanup */
$db->statement('DELETE FROM product_materials WHERE material_id IN (SELECT id FROM materials WHERE code = ? OR name LIKE ?)', ['SMK-FLC-520', 'Smoke %']);
$db->statement('DELETE FROM production_run_materials WHERE run_id IN (SELECT id FROM production_runs WHERE public_id = ?)', [$run]);
$db->statement('DELETE FROM production_runs WHERE public_id IN (?, ?)', [$run, $bigRun]);
$db->statement('DELETE FROM material_movements WHERE material_id IN (SELECT id FROM materials WHERE name LIKE ?)', ['Smoke %']);
$db->statement('DELETE FROM material_purchase_items WHERE purchase_id IN (SELECT id FROM material_purchases WHERE public_id = ?)', [$po]);
$db->statement('DELETE FROM material_purchases WHERE public_id = ?', [$po]);
$db->statement('DELETE FROM materials WHERE name LIKE ?', ['Smoke %']);
$db->statement('DELETE FROM suppliers WHERE name = ?', ['Smoke Mills']);
$db->statement('UPDATE stock_items SET total_units = ? WHERE public_id = ?', [$before, $itemId]);
$db->statement('DELETE FROM inventory_movements WHERE reference_type = ? AND reference_id = ?', ['production', $run]);

echo "\n  cleaned up the smoke-test records.\n";
printf("\n  %d passed, %d failed\n", $pass, $fail);
exit($fail === 0 ? 0 : 1);

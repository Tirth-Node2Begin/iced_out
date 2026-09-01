<?php

declare(strict_types=1);

/**
 * In-process smoke test of the CRM API.
 *
 * Signs in as staff, then drives a lead all the way to a won deal on the board,
 * through the REAL middleware pipeline — audience check, origin check,
 * validation, permissions, audit, the lot. Nothing is mocked and nothing is
 * stubbed; it talks to the configured database.
 *
 * It is a plain script rather than a PHPUnit case on purpose: it needs no
 * dependencies installed, so it is the first thing to run on a machine where
 * `composer install` has not happened yet.
 *
 *   php tests/Smoke/crm-smoke.php
 *
 * Every record it writes is deleted on the way out. It is safe against a seeded
 * database — where an assertion could only hold on an EMPTY one, it checks the
 * shape instead, and says so.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Json;

$app = Application::boot($root);
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

function call(string $method, string $path, array $body = null): array
{
    global $app, $cookies;
    $headers = ['x-client-audience' => 'admin', 'origin' => 'http://127.0.0.1:3100'];
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

// ---------------------------------------------------------------- auth gate
[$s] = call('GET', '/admin/crm/leads');
check('unauthenticated read is refused', $s === 401, "got $s");

[$s, $b] = call('POST', '/admin/auth/login', ['email' => 'admin@gmail.com', 'password' => 'admin123']);
check('staff sign-in', $s === 200, "got $s");
if ($s !== 200) {
    echo "\n  cannot continue without a session — is the database seeded?\n";
    echo '  ' . Json::encode($b) . "\n";
    exit(1);
}

// --------------------------------------------------------------- the module
[$s, $b] = call('GET', '/admin/crm/summary');
check('summary', $s === 200 && isset($b['data']['pipeline']), "got $s");

[$s, $b] = call('GET', '/admin/crm/owners');
check('owners picker', $s === 200 && count($b['data']['owners'] ?? []) > 0,
    'owners: ' . count($b['data']['owners'] ?? []));

// ------------------------------------------------------------------- a lead
[$s, $b] = call('POST', '/admin/crm/leads', [
    'name' => 'Smoke Test Buyer',
    'email' => 'smoke-test@example.com',
    'phone' => '9876500011',
    'company' => 'Smoke Test Retail',
    'source' => 'INSTAGRAM',
    'score' => 70,
    'message' => 'Wants 40 units of the Afterdark Hoodie for a pop-up.',
    'owner' => 'me',
]);
check('create lead', $s === 201, "got $s " . ($s !== 201 ? Json::encode($b) : ''));
$leadId = $b['data']['lead']['id'] ?? null;
check('lead id minted', is_string($leadId) && str_starts_with((string) $leadId, 'lead-'), (string) $leadId);
check('lead owner resolved from "me"', ($b['data']['lead']['owner']['name'] ?? '') !== '',
    (string) ($b['data']['lead']['owner']['name'] ?? '—'));

[$s, $b] = call('PATCH', '/admin/crm/leads/' . $leadId, ['status' => 'CONTACTED', 'score' => 85]);
check('patch lead', $s === 200 && ($b['data']['lead']['status'] ?? '') === 'CONTACTED'
    && ($b['data']['lead']['score'] ?? 0) === 85, "got $s");

[$s, $b] = call('PATCH', '/admin/crm/leads/' . $leadId, ['status' => 'CONVERTED']);
check('CONVERTED is refused on a plain patch', $s === 422, "got $s");

// ---------------------------------------------------------------- convert it
[$s, $b] = call('POST', '/admin/crm/leads/' . $leadId . '/convert', [
    'createDeal' => true,
    'dealTitle' => 'Smoke Test pop-up order',
    'dealAmount' => 184000,
    'expectedCloseOn' => '2026-09-30',
]);
check('convert lead', $s === 200 && ($b['data']['lead']['status'] ?? '') === 'CONVERTED', "got $s " . ($s !== 200 ? Json::encode($b) : ''));
$contactId = $b['data']['lead']['convertedContactId'] ?? null;
$dealId = $b['data']['lead']['convertedDealId'] ?? null;
check('  → contact created', is_string($contactId) && str_starts_with((string) $contactId, 'cnt-'), (string) $contactId);
check('  → deal created', is_string($dealId) && str_starts_with((string) $dealId, 'deal-'), (string) $dealId);

[$s] = call('POST', '/admin/crm/leads/' . $leadId . '/convert', ['createDeal' => false]);
check('second convert is refused', $s === 409, "got $s");

// -------------------------------------------------------------- the contact
[$s, $b] = call('GET', '/admin/crm/contacts/' . $contactId);
check('contact detail', $s === 200, "got $s");
check('  → carries its deals', count($b['data']['deals'] ?? []) === 1, 'deals: ' . count($b['data']['deals'] ?? []));
check('  → company linked from the lead',
    ($b['data']['contact']['company']['name'] ?? '') === 'Smoke Test Retail',
    (string) ($b['data']['contact']['company']['name'] ?? '—'));

// ------------------------------------------------------------- a note + task
[$s, $b] = call('POST', '/admin/crm/notes', [
    'aboutType' => 'contact', 'aboutId' => $contactId,
    'body' => 'Calls only after 6pm.', 'pinned' => true,
]);
check('create note', $s === 201 && ($b['data']['note']['pinned'] ?? false) === true, "got $s");

[$s, $b] = call('POST', '/admin/crm/activities', [
    'subject' => 'Send the pop-up quote',
    'type' => 'EMAIL',
    'aboutType' => 'deal', 'aboutId' => $dealId,
    'dueAt' => '2020-01-01T09:00',
    'priority' => 'HIGH',
]);
check('create activity', $s === 201, "got $s " . ($s !== 201 ? Json::encode($b) : ''));
$actId = $b['data']['activity']['id'] ?? null;
check('  → a past due date reads as overdue', ($b['data']['activity']['overdue'] ?? false) === true);

[$s, $b] = call('POST', '/admin/crm/activities/' . $actId . '/complete', ['outcome' => 'Quote sent.']);
check('complete activity', $s === 200 && ($b['data']['activity']['done'] ?? false) === true, "got $s");
check('  → a completed task is no longer overdue', ($b['data']['activity']['overdue'] ?? true) === false);

// ---------------------------------------------------------------- the board
[$s, $b] = call('GET', '/admin/crm/deals');
check('board loads', $s === 200 && count($b['data']['columns'] ?? []) === 6,
    'columns: ' . count($b['data']['columns'] ?? []));
$openValue = $b['data']['summary']['openValue'] ?? '';
check('  → open value formatted en-IN', str_contains((string) $openValue, ','), (string) $openValue);
/* Null when nothing has settled, an integer once something has — and the two
   must stay distinguishable, because 0% and "no data" mean opposite things on a
   tile. The board is shared with whatever the demo seed put on it, so this
   asserts the SHAPE; the stronger "is null" only holds on a virgin board. */
$rate = $b['data']['summary']['winRate'] ?? 'missing';
check('  → win rate is null or a whole percentage',
    $rate === null || (is_int($rate) && $rate >= 0 && $rate <= 100),
    var_export($rate, true));

[$s, $b] = call('POST', '/admin/crm/deals/' . $dealId . '/move', ['stage' => 'proposal']);
check('move deal to Proposal', $s === 200 && ($b['data']['deal']['stage']['slug'] ?? '') === 'proposal', "got $s");
check('  → still OPEN', ($b['data']['deal']['status'] ?? '') === 'OPEN');

[$s, $b] = call('POST', '/admin/crm/deals/' . $dealId . '/move', ['stage' => 'won']);
check('move deal to Won', $s === 200, "got $s");
check('  → status settles to WON', ($b['data']['deal']['status'] ?? '') === 'WON');
check('  → probability settles to 100', ($b['data']['deal']['probability'] ?? 0) === 100);
check('  → closedAt stamped', ($b['data']['deal']['closedAt'] ?? null) !== null);

[$s, $b] = call('GET', '/admin/crm/deals');
check('win rate computed once settled', ($b['data']['summary']['winRate'] ?? null) === 100,
    'winRate: ' . var_export($b['data']['summary']['winRate'] ?? null, true));

// ------------------------------------------------------------ import + guards
[$s, $b] = call('GET', '/admin/crm/contacts/importable');
check('importable customers list', $s === 200, 'count: ' . count($b['data']['customers'] ?? []));

[$s, $b] = call('GET', '/admin/crm/leads/lead-9999');
check('unknown lead is 404', $s === 404, "got $s");

[$s, $b] = call('POST', '/admin/crm/leads', ['name' => '', 'email' => 'not-an-email']);
check('validation rejects a bad payload', $s === 422, "got $s");

// ------------------------------------------------------------------- cleanup
call('DELETE', '/admin/crm/deals/' . $dealId);
call('DELETE', '/admin/crm/contacts/' . $contactId);
call('DELETE', '/admin/crm/leads/' . $leadId);
$app->container->make(Iced\Kernel\Database::class)->statement(
    'DELETE FROM crm_companies WHERE name_normalized = ?', ['smoke test retail'],
);
echo "\n  cleaned up the smoke-test records.\n";

printf("\n  %d passed, %d failed\n", $pass, $fail);
exit($fail === 0 ? 0 : 1);

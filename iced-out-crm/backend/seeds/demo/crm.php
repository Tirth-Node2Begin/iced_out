<?php

declare(strict_types=1);

/**
 * A populated CRM, for looking at the screens with something on them.
 *
 * OPT-IN, like everything else under seeds/demo/ — the base seed gives you an
 * admin account, the catalogue and an empty pipeline, which is the correct state
 * for a real install. This is the demo store's relationship layer on top.
 *
 * Idempotent: every row is keyed on something stable, and running it twice
 * changes nothing.
 *
 *   php seeds/demo/crm.php
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Repository\Crm\ActivityRepository;
use Iced\Repository\Crm\CompanyRepository;
use Iced\Repository\Crm\ContactRepository;
use Iced\Repository\Crm\CrmIds;
use Iced\Repository\Crm\DealRepository;
use Iced\Repository\Crm\LeadRepository;
use Iced\Repository\Crm\NoteRepository;
use Iced\Support\Clock;

$app = Application::boot($root);
$db = $app->container->make(Database::class);
$clock = $app->container->make(Clock::class);
$ids = new CrmIds($db);

$leads = new LeadRepository($db, $clock, $ids);
$contacts = new ContactRepository($db, $clock, $ids);
$companies = new CompanyRepository($db, $clock, $ids);
$deals = new DealRepository($db, $clock, $ids);
$activities = new ActivityRepository($db, $clock, $ids);
$notes = new NoteRepository($db, $clock, $ids);

$out = static fn (string $line): int => print($line . PHP_EOL);

if ($db->selectOne('SELECT id FROM crm_leads WHERE deleted_at IS NULL LIMIT 1') !== null) {
    $out('The CRM already has records — nothing seeded.');
    exit(0);
}

$admin = $db->selectOne('SELECT id FROM users WHERE type = ? ORDER BY id LIMIT 1', ['STAFF']);
$ownerId = $admin === null ? null : (int) $admin['id'];

$pipeline = $deals->defaultPipeline();

if ($pipeline === null) {
    $out('No pipeline — run `php bin/console.php migrate` first.');
    exit(1);
}

$stages = [];

foreach ($deals->stages((int) $pipeline['id']) as $stage) {
    $stages[(string) $stage['slug']] = $stage;
}

/* --------------------------------------------------------------- companies */
$companyIds = [];

foreach ([
    ['Northside Retail', 'northside.example', 'Fashion retail', '11-50', 'Mumbai'],
    ['Aster & Co', 'asterco.example', 'Concept store', '1-10', 'Bengaluru'],
    ['Kestrel Studio', 'kestrel.example', 'Styling', '1-10', 'Delhi'],
] as [$name, $domain, $industry, $size, $city]) {
    $companyIds[$name] = $companies->create([
        'name' => $name,
        'domain' => $domain,
        'industry' => $industry,
        'sizeBand' => $size,
        'email' => 'hello@' . $domain,
        'phone' => '',
        'website' => 'https://' . $domain,
        'city' => $city,
        'state' => '',
        'country' => 'India',
        'ownerId' => $ownerId,
    ])['id'];
}

$out(sprintf('  + %d companies', count($companyIds)));

/* ---------------------------------------------------------------- contacts */
$contactIds = [];

foreach ([
    ['Ishaan', 'Verma', 'ishaan@northside.example', '9876500021', 'Head buyer', 'CUSTOMER', 'Northside Retail'],
    ['Meera', 'Nair', 'meera@asterco.example', '9876500022', 'Owner', 'QUALIFIED', 'Aster & Co'],
    ['Rhea', 'Kapoor', 'rhea@kestrel.example', '9876500023', 'Stylist', 'LEAD', 'Kestrel Studio'],
    ['Devan', 'Rao', 'devan@example.com', '9876500024', '', 'CUSTOMER', null],
] as [$first, $last, $email, $phone, $title, $lifecycle, $company]) {
    $contactIds[$email] = $contacts->create([
        'firstName' => $first,
        'lastName' => $last,
        'email' => $email,
        'phone' => $phone,
        'jobTitle' => $title,
        'lifecycle' => $lifecycle,
        'source' => 'REFERRAL',
        'city' => '',
        'state' => '',
        'country' => 'India',
        'companyId' => $company === null ? null : $companyIds[$company],
        'userId' => null,
        'ownerId' => $ownerId,
    ])['id'];
}

$out(sprintf('  + %d contacts', count($contactIds)));

/* ------------------------------------------------------------------- deals */
$dealIds = [];

foreach ([
    ['Northside AW pre-order', 'qualified', 428000, 'ishaan@northside.example', 'Northside Retail', 40],
    ['Aster & Co capsule drop', 'proposal', 186500, 'meera@asterco.example', 'Aster & Co', 60],
    ['Kestrel editorial pull', 'new', 62000, 'rhea@kestrel.example', 'Kestrel Studio', 15],
    ['Northside repeat order', 'won', 214000, 'ishaan@northside.example', 'Northside Retail', 100],
] as [$title, $stage, $amount, $contactEmail, $companyName, $chance]) {
    $dealIds[$title] = $deals->create([
        'title' => $title,
        'pipelineId' => (int) $pipeline['id'],
        'stageId' => (int) $stages[$stage]['id'],
        'contactId' => $contactIds[$contactEmail],
        'companyId' => $companyIds[$companyName],
        'amount' => number_format((float) $amount, 2, '.', ''),
        'currency' => 'INR',
        'source' => 'REFERRAL',
        'probability' => $chance,
        'expectedCloseOn' => null,
        'ownerId' => $ownerId,
    ])['id'];
}

/* The won one has to be settled, or the board shows a card in the Won column
   that the summary still counts as open. */
$db->statement(
    "UPDATE crm_deals SET status = 'WON', closed_at = ? WHERE id = ?",
    [$clock->nowString(), $dealIds['Northside repeat order']],
);

$out(sprintf('  + %d deals', count($dealIds)));

/* ------------------------------------------------------------------- leads */
foreach ([
    ['Priya Shah', 'priya@example.com', '9876500031', 'Loom & Ash', 'INSTAGRAM', 'NEW', 65, 'Saw the AW campaign, asking about wholesale terms.'],
    ['Arjun Menon', 'arjun@example.com', '9876500032', '', 'WEBSITE', 'CONTACTED', 40, 'Wants to know when the heavyweight hoodie restocks.'],
    ['Sana Qureshi', 'sana@example.com', '9876500033', 'The Fifth Wall', 'REFERRAL', 'QUALIFIED', 80, 'Referred by Aster & Co. Opening a second store in October.'],
    ['Vikram Iyer', 'vikram@example.com', '', '', 'WALK_IN', 'UNQUALIFIED', 10, 'Walked in asking about a bulk discount on one piece.'],
] as [$name, $email, $phone, $company, $source, $status, $score, $message]) {
    $leads->create([
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'company' => $company,
        'source' => $source,
        'status' => $status,
        'score' => $score,
        'message' => $message,
        'ownerId' => $status === 'NEW' ? null : $ownerId,
    ]);
}

$out('  + 4 leads');

/* -------------------------------------------------------------- activities */
/* One of each state the task list has a tab for, so every tab has something in
   it the first time it is opened. */
$dueIn = static fn (int $hours): string => $clock
    ->now()
    ->modify(sprintf('%+d hours', $hours))
    ->format('Y-m-d H:i:s.u');

foreach ([
    ['Chase the Northside PO', 'CALL', 'deal', $dealIds['Northside AW pre-order'], -30, 'HIGH'],
    ['Send the Aster capsule quote', 'EMAIL', 'deal', $dealIds['Aster & Co capsule drop'], 3, 'NORMAL'],
    ['Kestrel sample pull-together', 'MEETING', 'deal', $dealIds['Kestrel editorial pull'], 52, 'NORMAL'],
    ['Check in with Devan', 'CALL', 'contact', $contactIds['devan@example.com'], 120, 'LOW'],
] as [$subject, $type, $subjectType, $subjectId, $hours, $priority]) {
    $activities->create([
        'type' => $type,
        'subject' => $subject,
        'body' => '',
        'subjectType' => $subjectType,
        'subjectId' => $subjectId,
        'dueAt' => $dueIn($hours),
        'priority' => $priority,
        'ownerId' => $ownerId,
        'createdBy' => $ownerId,
    ]);
}

/* One already done, so the Done tab is not empty either. */
$done = $activities->create([
    'type' => 'MEETING',
    'subject' => 'Northside intro call',
    'body' => '',
    'subjectType' => 'deal',
    'subjectId' => $dealIds['Northside AW pre-order'],
    'dueAt' => $dueIn(-96),
    'priority' => 'NORMAL',
    'ownerId' => $ownerId,
    'createdBy' => $ownerId,
]);

$row = $db->selectOne('SELECT id FROM crm_activities WHERE public_id = ?', [$done]);
$activities->complete((int) $row['id'], 'They want AW pieces plus two carryover styles.');

$out('  + 5 activities');

/* ------------------------------------------------------------------- notes */
$notes->create('contact', $contactIds['ishaan@northside.example'], 'Calls only after 6pm — he is on the shop floor until then.', true, $ownerId);
$notes->create('deal', $dealIds['Aster & Co capsule drop'], 'Meera wants the capsule exclusive to her store for the first two weeks.', false, $ownerId);

$out('  + 2 notes');
$out('Demo CRM seeded.');

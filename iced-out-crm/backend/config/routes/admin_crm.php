<?php

declare(strict_types=1);

use Iced\Controller\Console\Crm\ActivityController;
use Iced\Controller\Console\Crm\CompanyController;
use Iced\Controller\Console\Crm\ContactController;
use Iced\Controller\Console\Crm\CrmDashboardController;
use Iced\Controller\Console\Crm\DealController;
use Iced\Controller\Console\Crm\LeadController;
use Iced\Controller\Console\Crm\NoteController;
use Iced\Kernel\Route;

/**
 * The CRM layer — leads, contacts, companies, deals, activities and notes.
 *
 * Two permissions cover the whole module: `crm.view` to read, `crm.manage` to
 * change. Finer grain would be theatre — anyone trusted to reassign a deal is
 * trusted to reassign a contact, and a matrix nobody can hold in their head is
 * a matrix that gets granted wholesale.
 *
 * OPTIONAL STRING FIELDS CARRY `nullable`. Without it the validator drops a
 * present-but-empty value, and a PATCH that clears a field silently does
 * nothing — see Iced\Support\Validator. `nullable` lets the blank through as
 * null, which the controllers read back as "" and write to the column.
 */

$read = static fn (string $path, string $class, string $method, string $name): array => [
    'method' => 'GET',
    'path' => $path,
    'handler' => [$class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => 'crm.view',
    'rate_limit' => 'console_read',
    'name' => $name,
];

/** @param array<string, string> $rules */
$write = static fn (string $method, string $path, string $class, string $handler, string $name, array $rules = []): array => [
    'method' => $method,
    'path' => $path,
    'handler' => [$class, $handler],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => 'crm.manage',
    'rate_limit' => 'console_write',
    'name' => $name,
    'rules' => $rules,
    'audit' => true,
];

/** Shared by the lead and contact forms — the same person, described twice. */
$sourceRule = 'nullable|string|in:WEBSITE,INSTAGRAM,REFERRAL,WALK_IN,CAMPAIGN,SUPPORT,IMPORT,OTHER';

return [
    // ---------------------------------------------------------------- overview
    $read('/admin/crm/summary', CrmDashboardController::class, 'summary', 'admin.crm.summary'),
    $read('/admin/crm/owners', CrmDashboardController::class, 'owners', 'admin.crm.owners'),

    // ------------------------------------------------------------------- leads
    $read('/admin/crm/leads', LeadController::class, 'index', 'admin.crm.leads.index'),
    $read('/admin/crm/leads/{lead}', LeadController::class, 'show', 'admin.crm.leads.show'),

    $write('POST', '/admin/crm/leads', LeadController::class, 'store', 'admin.crm.leads.store', [
        'name' => 'required|string|max:160',
        'email' => 'nullable|string|email|max:190',
        'phone' => 'nullable|string|max:20',
        'company' => 'nullable|string|max:160',
        'source' => $sourceRule,
        'status' => 'nullable|string|in:NEW,CONTACTED,QUALIFIED,UNQUALIFIED',
        'score' => 'nullable|int|min:0|max:100',
        'message' => 'nullable|string|max:2000',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('PATCH', '/admin/crm/leads/{lead}', LeadController::class, 'update', 'admin.crm.leads.update', [
        'name' => 'nullable|string|max:160',
        'email' => 'nullable|string|email|max:190',
        'phone' => 'nullable|string|max:20',
        'company' => 'nullable|string|max:160',
        'source' => $sourceRule,
        'status' => 'nullable|string|in:NEW,CONTACTED,QUALIFIED,UNQUALIFIED',
        'score' => 'nullable|int|min:0|max:100',
        'message' => 'nullable|string|max:2000',
        'lostReason' => 'nullable|string|max:190',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('POST', '/admin/crm/leads/{lead}/convert', LeadController::class, 'convert', 'admin.crm.leads.convert', [
        'company' => 'nullable|string|max:160',
        'createDeal' => 'nullable|bool',
        'dealTitle' => 'nullable|string|max:190',
        'dealAmount' => 'nullable|number|min:0',
        'expectedCloseOn' => 'nullable|string|regex:/^\d{4}-\d{2}-\d{2}$/',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('DELETE', '/admin/crm/leads/{lead}', LeadController::class, 'destroy', 'admin.crm.leads.destroy'),

    // ---------------------------------------------------------------- contacts
    /* Above the `{contact}` routes on purpose — the router matches in table
       order, and a literal segment declared after a parameter one would be
       swallowed by it ("importable" read as a contact id). */
    $read('/admin/crm/contacts/importable', ContactController::class, 'importable', 'admin.crm.contacts.importable'),
    $read('/admin/crm/contacts', ContactController::class, 'index', 'admin.crm.contacts.index'),
    $read('/admin/crm/contacts/{contact}', ContactController::class, 'show', 'admin.crm.contacts.show'),

    $write('POST', '/admin/crm/contacts/import', ContactController::class, 'import', 'admin.crm.contacts.import', [
        'customers' => 'required|array|min:1|max:500',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('POST', '/admin/crm/contacts', ContactController::class, 'store', 'admin.crm.contacts.store', [
        'firstName' => 'required|string|max:80',
        'lastName' => 'nullable|string|max:80',
        'email' => 'nullable|string|email|max:190',
        'phone' => 'nullable|string|max:20',
        'jobTitle' => 'nullable|string|max:120',
        'lifecycle' => 'nullable|string|in:SUBSCRIBER,LEAD,QUALIFIED,CUSTOMER,CHURNED',
        'source' => $sourceRule,
        'city' => 'nullable|string|max:80',
        'state' => 'nullable|string|max:80',
        'country' => 'nullable|string|max:80',
        'company' => 'nullable|string|max:40',
        'customer' => 'nullable|string|max:40',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('PATCH', '/admin/crm/contacts/{contact}', ContactController::class, 'update', 'admin.crm.contacts.update', [
        'firstName' => 'nullable|string|max:80',
        'lastName' => 'nullable|string|max:80',
        'email' => 'nullable|string|email|max:190',
        'phone' => 'nullable|string|max:20',
        'jobTitle' => 'nullable|string|max:120',
        'lifecycle' => 'nullable|string|in:SUBSCRIBER,LEAD,QUALIFIED,CUSTOMER,CHURNED',
        'source' => $sourceRule,
        'city' => 'nullable|string|max:80',
        'state' => 'nullable|string|max:80',
        'country' => 'nullable|string|max:80',
        'company' => 'nullable|string|max:40',
        'customer' => 'nullable|string|max:40',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('DELETE', '/admin/crm/contacts/{contact}', ContactController::class, 'destroy', 'admin.crm.contacts.destroy'),

    // --------------------------------------------------------------- companies
    $read('/admin/crm/companies/options', CompanyController::class, 'options', 'admin.crm.companies.options'),
    $read('/admin/crm/companies', CompanyController::class, 'index', 'admin.crm.companies.index'),
    $read('/admin/crm/companies/{company}', CompanyController::class, 'show', 'admin.crm.companies.show'),

    $write('POST', '/admin/crm/companies', CompanyController::class, 'store', 'admin.crm.companies.store', [
        'name' => 'required|string|max:160',
        'domain' => 'nullable|string|max:190',
        'industry' => 'nullable|string|max:80',
        'sizeBand' => 'nullable|string|in:1-10,11-50,51-200,201-500,500+',
        'email' => 'nullable|string|email|max:190',
        'phone' => 'nullable|string|max:20',
        'website' => 'nullable|string|max:190',
        'city' => 'nullable|string|max:80',
        'state' => 'nullable|string|max:80',
        'country' => 'nullable|string|max:80',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('PATCH', '/admin/crm/companies/{company}', CompanyController::class, 'update', 'admin.crm.companies.update', [
        'name' => 'nullable|string|max:160',
        'domain' => 'nullable|string|max:190',
        'industry' => 'nullable|string|max:80',
        'sizeBand' => 'nullable|string|in:1-10,11-50,51-200,201-500,500+',
        'email' => 'nullable|string|email|max:190',
        'phone' => 'nullable|string|max:20',
        'website' => 'nullable|string|max:190',
        'city' => 'nullable|string|max:80',
        'state' => 'nullable|string|max:80',
        'country' => 'nullable|string|max:80',
        'status' => 'nullable|string|in:ACTIVE,ARCHIVED',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('DELETE', '/admin/crm/companies/{company}', CompanyController::class, 'destroy', 'admin.crm.companies.destroy'),

    // ------------------------------------------------------------------- deals
    $read('/admin/crm/deals', DealController::class, 'board', 'admin.crm.deals.board'),
    $read('/admin/crm/deals/{deal}', DealController::class, 'show', 'admin.crm.deals.show'),

    $write('POST', '/admin/crm/deals', DealController::class, 'store', 'admin.crm.deals.store', [
        'title' => 'required|string|max:190',
        'pipeline' => 'nullable|string|max:80',
        'stage' => 'nullable|string|max:80',
        'contact' => 'nullable|string|max:40',
        'company' => 'nullable|string|max:40',
        'amount' => 'nullable|number|min:0',
        'source' => $sourceRule,
        'probability' => 'nullable|int|min:0|max:100',
        'expectedCloseOn' => 'nullable|string|regex:/^\d{4}-\d{2}-\d{2}$/',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('PATCH', '/admin/crm/deals/{deal}', DealController::class, 'update', 'admin.crm.deals.update', [
        'title' => 'nullable|string|max:190',
        'contact' => 'nullable|string|max:40',
        'company' => 'nullable|string|max:40',
        'order' => 'nullable|string|max:40',
        'amount' => 'nullable|number|min:0',
        'source' => $sourceRule,
        'probability' => 'nullable|int|min:0|max:100',
        'expectedCloseOn' => 'nullable|string|regex:/^\d{4}-\d{2}-\d{2}$/',
        'lostReason' => 'nullable|string|max:190',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('POST', '/admin/crm/deals/{deal}/move', DealController::class, 'move', 'admin.crm.deals.move', [
        'stage' => 'required|string|max:80',
        'before' => 'nullable|string|max:40',
        'after' => 'nullable|string|max:40',
    ]),
    $write('DELETE', '/admin/crm/deals/{deal}', DealController::class, 'destroy', 'admin.crm.deals.destroy'),

    // -------------------------------------------------------------- activities
    $read('/admin/crm/activities', ActivityController::class, 'index', 'admin.crm.activities.index'),

    $write('POST', '/admin/crm/activities', ActivityController::class, 'store', 'admin.crm.activities.store', [
        'subject' => 'required|string|max:190',
        'type' => 'nullable|string|in:TASK,CALL,MEETING,EMAIL,WHATSAPP',
        'body' => 'nullable|string|max:4000',
        'aboutType' => 'required|string|in:lead,contact,company,deal,order',
        'aboutId' => 'required|string|max:40',
        'dueAt' => 'nullable|string|max:32',
        'priority' => 'nullable|string|in:LOW,NORMAL,HIGH',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('PATCH', '/admin/crm/activities/{activity}', ActivityController::class, 'update', 'admin.crm.activities.update', [
        'subject' => 'nullable|string|max:190',
        'type' => 'nullable|string|in:TASK,CALL,MEETING,EMAIL,WHATSAPP',
        'body' => 'nullable|string|max:4000',
        'dueAt' => 'nullable|string|max:32',
        'priority' => 'nullable|string|in:LOW,NORMAL,HIGH',
        'owner' => 'nullable|string|max:40',
    ]),
    $write('POST', '/admin/crm/activities/{activity}/complete', ActivityController::class, 'complete', 'admin.crm.activities.complete', [
        'outcome' => 'nullable|string|max:190',
    ]),
    $write('POST', '/admin/crm/activities/{activity}/reopen', ActivityController::class, 'reopen', 'admin.crm.activities.reopen'),
    $write('DELETE', '/admin/crm/activities/{activity}', ActivityController::class, 'destroy', 'admin.crm.activities.destroy'),

    // ------------------------------------------------------------------- notes
    $read('/admin/crm/notes', NoteController::class, 'index', 'admin.crm.notes.index'),

    $write('POST', '/admin/crm/notes', NoteController::class, 'store', 'admin.crm.notes.store', [
        'body' => 'required|string|max:4000',
        'aboutType' => 'required|string|in:lead,contact,company,deal,order',
        'aboutId' => 'required|string|max:40',
        'pinned' => 'nullable|bool',
    ]),
    $write('PATCH', '/admin/crm/notes/{note}', NoteController::class, 'update', 'admin.crm.notes.update', [
        'body' => 'nullable|string|max:4000',
        'pinned' => 'nullable|bool',
    ]),
    $write('DELETE', '/admin/crm/notes/{note}', NoteController::class, 'destroy', 'admin.crm.notes.destroy'),
];

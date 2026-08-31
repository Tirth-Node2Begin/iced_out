<?php

declare(strict_types=1);

use Iced\Controller\Console\ShipmentController;
use Iced\Kernel\Route;

/**
 * Spec §8.20 — console shipments, pickups, NDR (10).
 *
 * Note what the `rules` here do and do not check. They check the SHAPE of the
 * request — is it a string, is it short enough. They do not enumerate couriers
 * or failure reasons, because those are vocabularies an operator owns: they
 * live in `store_settings` and are checked in ShipmentService against whatever
 * the table says today. A route file is loaded before any database connection
 * exists, so a list written here could only ever be a stale copy.
 */

$action = static fn (string $path, string $method, string $name, string $permission = 'shipping.manage'): array => [
    'method' => 'POST',
    'path' => $path,
    'handler' => [ShipmentController::class, $method],
    'audience' => Route::AUDIENCE_STAFF,
    'permission' => $permission,
    'rate_limit' => 'console_write',
    'name' => $name,
];

return [
    [
        'method' => 'GET',
        'path' => '/admin/shipments',
        'handler' => [ShipmentController::class, 'index'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'shipping.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.shipments.index',
    ],
    [
        'method' => 'GET',
        'path' => '/admin/shipments/ndr',
        'handler' => [ShipmentController::class, 'ndr'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'shipping.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.shipments.ndr',
    ],
    [
        'method' => 'GET',
        'path' => '/admin/shipments/{id}',
        'handler' => [ShipmentController::class, 'show'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'shipping.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.shipments.show',
    ],
    $action('/admin/shipments/{id}/transition', 'transition', 'admin.shipments.transition') + [
        'rules' => [
            // The state names are the machine's own alphabet (spec §9.4), not a
            // vocabulary anyone edits, so they stay here.
            'status' => 'required|string|in:In transit,Delivered,Failed,Cancelled',
            'reason' => 'string|max:120',
        ],
    ],
    $action('/admin/shipments/{id}/resend', 'resend', 'admin.shipments.resend'),
    $action('/admin/shipments/{id}/return-to-store', 'returnToStore', 'admin.shipments.return_to_store'),
    $action('/admin/shipments/{id}/arrived-back', 'arrivedBack', 'admin.shipments.arrived_back'),
    $action('/admin/shipments/{id}/label', 'label', 'admin.shipments.label', 'shipping.view'),
    $action('/admin/shipments/{id}/refresh', 'refresh', 'admin.shipments.refresh', 'shipping.view'),
    [
        'method' => 'GET',
        'path' => '/admin/pickups',
        'handler' => [ShipmentController::class, 'pickups'],
        'audience' => Route::AUDIENCE_STAFF,
        'permission' => 'shipping.view',
        'rate_limit' => 'console_read',
        'name' => 'admin.pickups.index',
    ],
    $action('/admin/pickups', 'createPickup', 'admin.pickups.create') + [
        'rules' => [
            'provider' => 'required|string|max:40',
            'parcels' => 'required|int|min:1|max:999',
            'pickup' => 'required|string|max:60',
        ],
    ],
    $action('/admin/pickups/{id}/handover', 'handover', 'admin.pickups.handover'),
];

<?php

declare(strict_types=1);

/**
 * Permission codes and the role matrix (spec §5.5). This file is the source of
 * truth; `console.php seed` mirrors it into `permissions` / `role_permissions`,
 * and the route tables in config/routes/ name codes from `codes` below.
 *
 * v1 seeds only ADMIN (matching the UI), but the whole matrix is built now.
 */
return [
    'codes' => [
        'dashboard.view',

        'orders.view',
        'orders.manage',

        'shipping.view',
        'shipping.manage',

        'catalog.view',
        'catalog.edit',
        'catalog.publish',

        'inventory.view',
        'inventory.adjust',
        'inventory.transfer',

        'returns.view',
        'returns.approve',

        'coupons.manage',

        'payments.view',
        'payments.reconcile',
        'payments.exports.create',
        'refunds.request',
        'refunds.approve',

        'customers.view',
        'customers.manage',

        'reviews.moderate',

        'support.tickets.manage',

        'reports.operational.view',

        'settings.manage',
        'audit.view',

        // Page composition — what the storefront's own pages show. Held apart
        // from `catalog.edit` on purpose: choosing which garments lead the home
        // page is merchandising, and being allowed to change a product's price
        // is not thereby being allowed to redress the front of the shop.
        'cms.manage',

        'media.upload',

        // The relationship layer. Two codes, not twelve: anyone trusted to
        // reassign a deal is trusted to reassign the contact behind it, and a
        // matrix nobody can hold in their head gets granted wholesale anyway.
        'crm.view',
        'crm.manage',
    ],

    'roles' => [
        // '*' is the wildcard the Principal understands — ADMIN holds every code.
        'ADMIN' => ['*'],

        'MANAGER' => [
            'dashboard.view',
            'orders.view', 'orders.manage',
            'shipping.view', 'shipping.manage',
            'catalog.view', 'catalog.edit', 'catalog.publish',
            'inventory.view', 'inventory.adjust', 'inventory.transfer',
            'returns.view', 'returns.approve',
            'coupons.manage',
            'payments.view', 'payments.reconcile', 'refunds.request',
            'customers.view', 'customers.manage',
            'reviews.moderate',
            'support.tickets.manage',
            'reports.operational.view',
            'cms.manage',
            'media.upload',
            'crm.view', 'crm.manage',
        ],

        'SUPPORT' => [
            'dashboard.view',
            'orders.view',
            'shipping.view',
            'returns.view',
            'payments.view',
            'customers.view',
            'reviews.moderate',
            'support.tickets.manage',
            // Support answers the people in these records all day; being able to
            // log the call they just took is the whole point of the module.
            'crm.view', 'crm.manage',
        ],

        'WAREHOUSE' => [
            'dashboard.view',
            'orders.view',
            'shipping.view', 'shipping.manage',
            'inventory.view', 'inventory.adjust', 'inventory.transfer',
            'returns.view',
        ],
    ],
];

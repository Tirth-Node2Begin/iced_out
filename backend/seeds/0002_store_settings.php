<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Support\Json;

/**
 * Every policy value, threshold and vocabulary the domain reads.
 *
 * This is the whole point of `Service\Settings\StoreSettings`: an operator can
 * change any of these without a deploy, and nothing in `src/` may hard-code a
 * value that appears here. If you find yourself typing a fee, a threshold, a
 * courier name or a reason string into a class, it belongs in this file instead.
 *
 * Merged, not replaced: a key an operator has edited keeps its value, while a
 * key added by a later version of this file is filled in. So re-seeding a live
 * dev store adds what is new without undoing anyone's work.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);

    $defaults = [
        'delivery' => [
            'standard_fee' => 199,
            'express_fee' => 499,
            'free_over' => 4999,
            'standard_window' => [3, 5],
            'express_window' => [1, 2],
        ],
        'cod' => [
            'max' => 5000,
            'fee' => 0,
            'waive_over' => null,
        ],
        'inventory' => [
            'low_stock_at' => 4,
            'reservation_ttl_prepaid' => 900,
            'reservation_ttl_cod' => 600,
            'max_per_order' => 3,
            // A top is sized by letter, a bottom by waist inches, and an
            // accessory by neither: genuinely different vocabularies, so the form
            // asks the category first.
            //
            // `Accessory` was missing, which meant a pouch, a chain or a boot had
            // no category to be taken into stock under — so none of the shop's
            // accessories could exist as inventory, and the storefront showed them
            // as hardcoded tiles instead.
            'categories' => ['Top', 'Bottom', 'Accessory'],
            'sizes_by_category' => [
                'Top' => ['S', 'M', 'L', 'XL', 'XXL'],
                'Bottom' => ['30', '32', '34', '36', '38', '40', '42'],
                // `OS` is one size; the numbers are UK shoe sizes, for footwear.
                'Accessory' => ['OS', '7', '8', '9', '10', '11', '12'],
            ],
            'types_by_category' => [
                'Top' => ['T-shirt', 'Shirt', 'Hoodie', 'Overshirt', 'Jacket'],
                'Bottom' => ['Jeans', 'Cargo', 'Casual', 'Joggers', 'Shorts'],
                'Accessory' => ['Bag', 'Jewellery', 'Footwear', 'Headwear', 'Bundle'],
            ],
        ],
        'shipping' => [
            'providers' => ['Blue Dart', 'Delhivery', 'Ecom Express'],
            'fail_reasons' => [
                'Nobody was home',
                'Address was wrong',
                'Customer said no',
                'Could not reach the customer',
                'Not shared yet',
            ],
            'max_delivery_attempts' => 3,
            'handling_states' => ['Needs action', 'Sending back', 'Back in store'],
        ],
        'returns' => [
            'reasons' => ['Size / fit', 'Changed mind', 'Quality concern', 'Wrong item', 'Damaged in transit'],
            'outcomes' => ['Voucher', 'Exchange'],
            'window_days' => 14,
        ],
        'payments' => [
            'gateways' => ['Razorpay', 'Stripe', 'Cashfree', 'On device', 'Courier'],
            'refund_reasons' => ['Return approved', 'Order cancelled', 'Payment mismatch', 'Goodwill'],
            'methods' => ['UPI', 'Card', 'Netbanking', 'Cash on delivery'],
        ],
        'catalog' => [
            'product_states' => ['Published', 'Scheduled', 'Draft'],
            'collection_states' => ['Live', 'Scheduled', 'Draft'],
            'variant_states' => ['Active', 'Low', 'Out', 'Archived'],
        ],
        'media' => [
            // Spec §14 caps: 8 MB console, 5 MB customer, 2 MB staff photo.
            'max_bytes_console' => 8_388_608,
            'max_bytes_customer' => 5_242_880,
            'max_bytes_staff_photo' => 2_097_152,
            'allowed_mime' => ['image/jpeg', 'image/png', 'image/webp'],
            'max_edge' => 1600,
            'quality' => 82,
        ],
        'security' => [
            'login_lockout_after' => 20,
            'login_lockout_window' => 900,
            'idempotency_ttl_hours' => 48,
        ],
        'sessions' => [
            'customer_ttl' => 2592000,
            'staff_idle_ttl' => 900,
        ],
        // Static-export reserved slots (spec §11). The allocator reads its pool
        // bounds from here, so widening the pools after a frontend rebuild is a
        // settings change and not a code change.
        /**
         * Id pools — UNBOUNDED, and that is the whole change here.
         *
         * These four used to be capped: thirty orders, thirty tracking tokens,
         * thirty payments, thirty customers. `ord-local-01` was not a placeholder
         * name, it was the real id of the first order anyone placed — and the
         * thirty-first threw "id pool exhausted — rebuild the frontend with more
         * slots".
         *
         * The cap existed because the frontend was a static export that had to
         * pre-render one page per id, so the ids had to be known at build time and
         * had to be few. The frontend is client-rendered now and reads the id from
         * the query, so nothing has to be enumerated in advance. Dropping `to`
         * makes each of these a gap-filling series with no ceiling.
         *
         * The prefixes lose "local" with the cap: an order is not local to a
         * browser any more, it is a row.
         */
        'id_pools' => [
            'order' => ['prefix' => 'ord-', 'width' => 4, 'from' => 1001],
            'tracking' => ['prefix' => 'trk-', 'width' => 6, 'from' => 100001],
            'payment' => ['prefix' => 'pay_ICE', 'width' => 4, 'from' => 2001],
            'customer' => ['prefix' => 'cus-', 'width' => 4, 'from' => 2050],
        ],
        // Unbounded series. `from` is a floor, never the answer: the next value
        // is always derived from what the table already holds.
        'id_series' => [
            'shipment' => ['prefix' => 'shp-', 'width' => 0, 'from' => 1051],
            'pickup' => ['prefix' => 'PICK-', 'width' => 4, 'from' => 413],
            'review' => ['prefix' => 'REV-', 'width' => 0, 'from' => 2001],
            'support' => ['prefix' => 'IO-Q-', 'width' => 0, 'from' => 1004],
            'return' => ['prefix' => 'ret-', 'width' => 3, 'from' => 1],
            'refund' => ['prefix' => 'ref_ICE', 'width' => 3, 'from' => 1],
            'stock_item' => ['prefix' => 'ITM-', 'width' => 3, 'from' => 1],
            'transfer' => ['prefix' => 'TRF-', 'width' => 3, 'from' => 1],
            'voucher' => ['prefix' => 'IOV', 'width' => 3, 'from' => 1],
        ],
        'order_number' => [
            'prefix' => 'IO-2026-',
            'next_serial' => 1049,
        ],
        'support' => [
            'topics' => ['Delivery', 'Return or exchange', 'Payment or refund', 'Product and fit', 'Something else'],
            'no_order_label' => 'No order',
            'slas' => ['first_response_hours' => 24, 'resolution_hours' => 72],
        ],
        'business' => [
            'name' => 'Iced_out',
            'support_email' => 'help@iced-out.example',
            'gstin' => '',
            'tax_rates' => [],
        ],
    ];

    /**
     * Fills in keys the stored value does not have, leaving everything it does
     * have exactly as the operator left it.
     *
     * @param array<array-key, mixed> $stored
     * @param array<array-key, mixed> $default
     *
     * @return array{0: array<array-key, mixed>, 1: int}
     */
    $merge = static function (array $stored, array $default) use (&$merge): array {
        $added = 0;

        foreach ($default as $key => $value) {
            if (!array_key_exists($key, $stored)) {
                $stored[$key] = $value;
                ++$added;

                continue;
            }

            if (is_array($value) && is_array($stored[$key]) && $value !== [] && !array_is_list($value)) {
                /** @var array{0: array<array-key, mixed>, 1: int} $nested */
                $nested = $merge($stored[$key], $value);
                $stored[$key] = $nested[0];
                $added += $nested[1];
            }
        }

        return [$stored, $added];
    };

    return $db->transaction(static function (Database $db) use ($defaults, $merge): string {
        $created = 0;
        $filled = 0;

        foreach ($defaults as $key => $value) {
            $row = $db->selectOne('SELECT value_json FROM store_settings WHERE `key` = ?', [$key]);

            if ($row === null) {
                $db->statement(
                    'INSERT INTO store_settings (`key`, value_json, version) VALUES (?, ?, 1)',
                    [$key, Json::encode($value)],
                );
                ++$created;

                continue;
            }

            $stored = Json::decodeArray((string) $row['value_json']) ?? [];
            [$merged, $added] = $merge($stored, $value);

            if ($added > 0) {
                $db->statement(
                    'UPDATE store_settings SET value_json = ?, version = version + 1 WHERE `key` = ?',
                    [Json::encode($merged), $key],
                );
                $filled += $added;
            }
        }

        return sprintf('%d keys created, %d missing values filled in', $created, $filled);
    });
};

<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * The seven fixture reviews (`11-reviews/reviews.ts`), the three support
 * queries (`14-support/data/support-queries.ts`) and the customer-support FAQ
 * list.
 *
 * Reviews carry the product NAME as written plus a resolved product_id where
 * the catalogue has one — "Nocturne Cap" is a review of a product that is not
 * in the four-product fixture catalogue, and dropping it would lose a Hidden
 * row the moderation screen counts.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);
    /** @var Clock $clock */
    $clock = $container->get(Clock::class);

    $reviews = [
        ['REV-2041', 'Afterdark Hoodie', 5, 'A•••• K••••', 'Built like an outer layer should be.', 'The canvas has real structure without fighting movement. The shoulders sit exactly where the size guide suggested.', '04 Aug 2026', 'Published', 'Console'],
        ['REV-2040', 'Bone Utility Overshirt', 3, 'M•••• P••••', 'Good weight, awkward sleeve.', 'The fabric is genuinely heavy and the colour is accurate. The sleeve runs a little long on a 40 chest.', '04 Aug 2026', 'Published', 'Console'],
        ['REV-2039', 'Core Heavy Tee', 2, 'R•••• S••••', 'Shrank more than I expected.', 'Washed cold and it still came back a size shorter. The cotton itself is nice.', '03 Aug 2026', 'Published', 'Console'],
        ['REV-2036', 'Shadow Cargo 02', 5, 'D•• W••••', 'The only pair I reach for.', 'Pockets that actually hold something and a hem that sits right over a boot. Three months in and the knees have not gone.', '03 Aug 2026', 'Published', 'Console'],
        ['REV-2031', 'Nocturne Cap', 1, 'S••• R••••', 'Closed with a policy reason.', "Contained another shopper's contact details, so it was refused rather than published.", '02 Aug 2026', 'Hidden', 'Console'],
        ['REV-2028', 'Afterdark Hoodie', 5, 'You', 'Dense fabric and a clean oversized fit.', 'Dense fabric and a clean oversized fit. It has kept its shape through a month of daily wear.', '22 Jul 2026', 'Published', 'Customer'],
        ['REV-2024', 'Core Heavy Tee', 4, 'You', 'The uploaded image showed personal contact details.', 'The uploaded image showed personal contact details, so this one needs an edit before it can be published.', '19 Jul 2026', 'Hidden', 'Customer'],
    ];

    $queries = [
        ['IO-Q-1003', 'Riya S.', 'riya@example.com', 'Payment or refund', 'IO-2026-1047', 'I paid by UPI and the money has left my account, but the order still says it is waiting for confirmation. I do not want to pay twice.', '04 Aug 2026 · 14:18', 'Open', ''],
        ['IO-Q-1002', 'Maya P.', 'maya@example.com', 'Delivery', 'IO-2026-1046', 'The courier has marked me as unavailable, but nobody came to the address. Can it be sent out again this week?', '04 Aug 2026 · 11:05', 'Open', ''],
        ['IO-Q-1001', 'Aarav K.', 'aarav@example.com', 'Product and fit', 'No order', 'I am between sizes on the utility overshirt. Which size should I take if I usually wear a medium?', '03 Aug 2026 · 17:40', 'Resolved', 'The overshirt is cut loose, so a medium is the right call — take the large only if you plan to layer a hoodie under it.'],
    ];

    $faqs = [
        ['When will my order arrive?', 'Standard delivery lands in 3–5 working days and express in 1–2. You will get a tracking link the moment the parcel leaves the warehouse.'],
        ['How do I return something?', 'Open the order in your account and choose "Start a return" on the piece you are sending back. Pickup is arranged for you.'],
        ['When do I get my refund?', 'A settled return issues a voucher for the value straight away, which you can spend at checkout. Card refunds are handled by support case by case.'],
        ['Can I change the size after ordering?', 'While the order still says Processing, message support and we will swap it if the size is in stock. After dispatch it becomes an exchange.'],
        ['Do you ship outside India?', 'Not yet. Every order ships within India, and prices are inclusive of GST.'],
        ['How should I wash the heavyweight pieces?', 'Cold wash inside out, dry flat, and skip the bleach. Every product page lists the exact care for that fabric.'],
    ];

    return $db->transaction(static function (Database $db) use ($reviews, $queries, $faqs, $clock): string {
        $products = [];

        foreach ($db->select('SELECT id, public_id, name FROM products') as $row) {
            $products[(string) $row['name']] = (int) $row['id'];
        }

        $shopper = $db->selectOne('SELECT id FROM users WHERE public_id = ?', ['cus-2049']);

        foreach ($reviews as $review) {
            [$publicId, $product, $rating, $customer, $headline, $body, $submitted, $status, $origin] = $review;

            $db->statement(
                'INSERT INTO reviews
                    (public_id, product_name, product_id, rating, customer_name, user_id, headline, body,
                     submitted_label, status, origin)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    rating = VALUES(rating), headline = VALUES(headline), body = VALUES(body),
                    status = VALUES(status), origin = VALUES(origin)',
                [
                    $publicId, $product, $products[$product] ?? null, $rating, $customer,
                    $origin === 'Customer' && $shopper !== null ? (int) $shopper['id'] : null,
                    $headline, $body, $submitted, $status, $origin,
                ],
            );
        }

        // Published reviews are what the storefront quotes, so the rollup the PDP
        // reads is refreshed here rather than left at zero until a job runs.
        $db->statement(
            "INSERT INTO product_rating_summaries (product_id, review_count, rating_avg, refreshed_at)
             SELECT r.product_id, COUNT(*), ROUND(AVG(r.rating), 2), ?
               FROM reviews r
              WHERE r.product_id IS NOT NULL AND r.status = 'Published'
              GROUP BY r.product_id
             ON DUPLICATE KEY UPDATE
                review_count = VALUES(review_count), rating_avg = VALUES(rating_avg), refreshed_at = VALUES(refreshed_at)",
            [$clock->nowString()],
        );

        foreach ($queries as $query) {
            [$reference, $customer, $email, $topic, $order, $message, $sentAt, $status, $reply] = $query;

            $db->statement(
                'INSERT INTO support_queries
                    (public_id, customer_name, email, topic, order_number, message, sent_label, status, reply)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status = VALUES(status), reply = VALUES(reply)',
                [$reference, $customer, $email, $topic, $order, $message, $sentAt, $status, $reply],
            );
        }

        $db->statement('DELETE FROM faqs');

        foreach ($faqs as $position => $faq) {
            $db->statement(
                'INSERT INTO faqs (question, answer, position, is_active) VALUES (?, ?, ?, 1)',
                [$faq[0], $faq[1], $position],
            );
        }

        return sprintf('%d reviews, %d support queries, %d FAQs', count($reviews), count($queries), count($faqs));
    });
};

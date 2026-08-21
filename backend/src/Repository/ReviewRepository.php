<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;

final class ReviewRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly StoreSettings $settings,
    ) {
    }

    /**
     * @param array{status?: string, q?: string, product?: string, origin?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function search(array $filters): array
    {
        $where = ['1 = 1'];
        $bindings = [];

        if (($filters['status'] ?? '') !== '') {
            $where[] = 'r.status = ?';
            $bindings[] = $filters['status'];
        }

        if (($filters['origin'] ?? '') !== '') {
            $where[] = 'r.origin = ?';
            $bindings[] = $filters['origin'];
        }

        if (($filters['product'] ?? '') !== '') {
            $where[] = 'p.public_id = ?';
            $bindings[] = $filters['product'];
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(r.product_name LIKE ? OR r.headline LIKE ? OR r.customer_name LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($bindings, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT r.*, p.public_id AS product_slug FROM reviews r
               LEFT JOIN products p ON p.id = r.product_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY r.created_at DESC, r.id DESC',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT r.*, p.public_id AS product_slug FROM reviews r
               LEFT JOIN products p ON p.id = r.product_id WHERE r.public_id = ? LIMIT 1',
            [$publicId],
        );
    }

    /**
     * This customer's review of this product, if they have written one.
     *
     * Any state. A rejected review still occupies the slot — see
     * `uq_reviews_customer_product` for why letting somebody rewrite until
     * moderation agrees is the loophole this closes.
     *
     * @return array<string, mixed>|null
     */
    public function findByCustomerAndProduct(?int $userId, int $productId): ?array
    {
        if ($userId === null) {
            return null;
        }

        return $this->db->selectOne(
            'SELECT * FROM reviews WHERE user_id = ? AND product_id = ? LIMIT 1',
            [$userId, $productId],
        );
    }

    /**
     * Corrects what a review records.
     *
     * The desk's job is to decide on a review, not to rewrite it — so this is
     * deliberately narrow, and every use of it is audited. It exists for the
     * cases moderation actually meets: a headline carrying the shopper's full
     * name, an obscenity in an otherwise fair three-star, a rating that
     * contradicts its own text because the stars were tapped in the dark.
     *
     * @param array<string, mixed> $fields
     */
    public function update(string $publicId, array $fields): void
    {
        if ($fields === []) {
            return;
        }

        $sets = [];
        $bindings = [];

        foreach ($fields as $column => $value) {
            $sets[] = $column . ' = ?';
            $bindings[] = $value;
        }

        $bindings[] = $this->clock->nowString();
        $bindings[] = $publicId;

        $this->db->statement(
            'UPDATE reviews SET ' . implode(', ', $sets) . ', updated_at = ? WHERE public_id = ?',
            $bindings,
        );
    }

    public function setStatus(int $reviewId, string $status): void
    {
        $this->db->statement(
            'UPDATE reviews SET status = ?, updated_at = ? WHERE id = ?',
            [$status, $this->clock->nowString(), $reviewId],
        );
    }

    public function appendModeration(int $reviewId, string $from, string $to, ?int $actorId): void
    {
        $this->db->statement(
            'INSERT INTO review_moderation_history (review_id, from_status, to_status, actor_id, created_at) VALUES (?, ?, ?, ?, ?)',
            [$reviewId, $from, $to, $actorId, $this->clock->nowString()],
        );
    }

    public function nextPublicId(): string
    {
        $series = $this->settings->series('review', 'REV-', 2001);
        $row = $this->db->selectOne(
            'SELECT public_id FROM reviews WHERE public_id LIKE ? ORDER BY public_id DESC LIMIT 1',
            [$series['prefix'] . '%'],
        );

        $highest = $row === null ? 0 : (int) preg_replace('/\D/', '', (string) $row['public_id']);

        return $series['prefix'] . max($series['from'], $highest + 1);
    }

    public function insert(
        string $publicId,
        string $productName,
        ?int $productId,
        int $rating,
        string $customerName,
        ?int $userId,
        string $headline,
        string $body,
        ?string $fit,
        string $submittedLabel,
        string $origin,
        ?string $orderNumber,
    ): int {
        $id = $this->db->insert(
            "INSERT INTO reviews
                (public_id, product_name, product_id, rating, customer_name, user_id, headline, body, fit,
                 submitted_label, status, origin, order_number, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Published', ?, ?, ?)",
            [
                $publicId, $productName, $productId, $rating, $customerName, $userId, $headline, $body, $fit,
                $submittedLabel, $origin, $orderNumber, $this->clock->nowString(),
            ],
        );

        /* The rollup the storefront reads, moved in the same breath as the row
           it is derived from.

           It belongs here rather than in the two controllers that write reviews,
           because it is not a decision either of them makes — it is what has to
           be true afterwards. It used to hang off moderation alone, which was
           right while a review landed Pending and counted for nothing; now that
           a review is live on arrival, a summary that only moved on a decision
           left every product card and related tile reading "no reviews" for a
           piece whose own page was already quoting one. A third write path would
           have made the same mistake again. */
        $this->refreshRatingSummary($productId);

        return $id;
    }

    /**
     * Removes a review outright, and the moderation trail that belongs to it.
     *
     * A real delete, not a flag. `Hidden` is the reversible answer and covers
     * everything moderation normally needs; this is for a record that should not
     * exist at all — spam, a test row, a shopper exercising their right to have
     * what they wrote erased. Keeping a soft-deleted copy of that last one would
     * defeat the point of honouring it.
     *
     * The history goes too. `review_moderation_history` has no cascade to lean
     * on, and a record of decisions about a review that no longer exists is not
     * an audit trail — it is a residue that outlives the thing it describes.
     *
     * It frees the `(customer, product)` slot, so that shopper may write about
     * the piece again. That is the honest consequence: the shop no longer holds
     * a review from them, so it has no grounds to refuse a new one.
     */
    public function delete(int $reviewId): void
    {
        $this->db->statement('DELETE FROM review_moderation_history WHERE review_id = ?', [$reviewId]);
        $this->db->statement('DELETE FROM reviews WHERE id = ?', [$reviewId]);
    }

    /** Published reviews are what the storefront quotes, so the rollup follows the desk. */
    public function refreshRatingSummary(?int $productId): void
    {
        if ($productId === null) {
            return;
        }

        $this->db->statement(
            "INSERT INTO product_rating_summaries (product_id, review_count, rating_avg, refreshed_at)
             SELECT ?, COUNT(*), COALESCE(ROUND(AVG(rating), 2), 0), ?
               FROM reviews WHERE product_id = ? AND status = 'Published'
             ON DUPLICATE KEY UPDATE
                review_count = VALUES(review_count), rating_avg = VALUES(rating_avg), refreshed_at = VALUES(refreshed_at)",
            [$productId, $this->clock->nowString(), $productId],
        );
    }
}

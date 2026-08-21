<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * `home_hero_slides` — the garments that fly through the home page hero.
 *
 * Every read joins the two media rows and the product in one query rather than
 * letting a caller resolve them per slide: a hero holds a handful of rows and
 * the console draws all of them at once, so N+1 here would be three round trips
 * per card for no gain.
 *
 * `cutout_media_id` is joined WITHOUT the soft-delete filter the media table
 * otherwise carries. A cutout whose asset was deleted must read as "there is no
 * cutout" — which is what a NULL public id gives — rather than as a slide that
 * silently keeps pointing at bytes nobody can fetch.
 */
final class HomeHeroRepository
{
    private const SELECT = 'SELECT h.*,
                   p.public_id AS product_slug,
                   p.name AS product_name,
                   p.status AS product_status,
                   p.image_media_id AS product_media_id,
                   pim.public_id AS product_image_public_id,
                   src.public_id AS source_public_id,
                   cut.public_id AS cutout_public_id,
                   cut.width AS cutout_width,
                   cut.height AS cutout_height
              FROM home_hero_slides h
              LEFT JOIN products p ON p.id = h.product_id AND p.deleted_at IS NULL
              /* The photo the PRODUCT carries right now, which is a different
                 fact from `src` below — that one is the frame the current
                 cutout was actually made from. For a `Product` slide the two
                 drift apart the moment the piece is re-shot in the catalogue,
                 and the gap between them is what the console reports. */
              LEFT JOIN media_assets pim ON pim.id = p.image_media_id AND pim.deleted_at IS NULL
              LEFT JOIN media_assets src ON src.id = h.source_media_id AND src.deleted_at IS NULL
              LEFT JOIN media_assets cut ON cut.id = h.cutout_media_id AND cut.deleted_at IS NULL';

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Every slide, running order first — what the console lists.
     *
     * @return list<array<string, mixed>>
     */
    public function all(): array
    {
        return $this->db->select(self::SELECT . ' ORDER BY h.position, h.id');
    }

    /**
     * The slides the home page actually shows.
     *
     * Two conditions, and the second is the point of the whole feature: a slide
     * is only live once its background has come off. A photograph that is still
     * waiting on remove.bg, or whose cutout failed, stays in the console until
     * an operator deals with it — the hero renders garments floating on the
     * page, and one uncut frame among them reads as a broken build.
     *
     * @return list<array<string, mixed>>
     */
    public function running(): array
    {
        return $this->db->select(
            self::SELECT . " WHERE h.is_active = 1 AND h.cutout_state = 'Ready' AND cut.public_id IS NOT NULL
                             ORDER BY h.position, h.id",
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(self::SELECT . ' WHERE h.public_id = ? LIMIT 1', [$publicId]);
    }

    /** @param array<string, mixed> $slide */
    public function insert(array $slide): int
    {
        return $this->db->insert(
            'INSERT INTO home_hero_slides
                (public_id, product_id, source_kind, alt, source_media_id, cutout_state, position, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $slide['public_id'],
                $slide['product_id'],
                $slide['source_kind'] ?? 'Upload',
                $slide['alt'],
                $slide['source_media_id'],
                $slide['cutout_state'] ?? 'Pending',
                $slide['position'],
                $slide['is_active'],
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );
    }

    /**
     * A partial write — only the columns the caller named.
     *
     * Whitelisted rather than interpolated: the keys reach this from a request
     * body, and a column name built out of one is how an UPDATE grows a clause
     * nobody wrote.
     *
     * @param array<string, mixed> $fields
     */
    public function update(string $publicId, array $fields): void
    {
        $allowed = [
            'product_id', 'source_kind', 'alt', 'source_media_id', 'cutout_media_id',
            'cutout_state', 'cutout_detail', 'cutout_edge_clear', 'cutout_at', 'position', 'is_active',
        ];

        $set = [];
        $bindings = [];

        foreach ($allowed as $column) {
            if (array_key_exists($column, $fields)) {
                $set[] = $column . ' = ?';
                $bindings[] = $fields[$column];
            }
        }

        if ($set === []) {
            return;
        }

        $set[] = 'updated_at = ?';
        $bindings[] = $this->clock->nowString();
        $bindings[] = $publicId;

        $this->db->statement(
            'UPDATE home_hero_slides SET ' . implode(', ', $set) . ' WHERE public_id = ?',
            $bindings,
        );
    }

    /**
     * Gone, row and all.
     *
     * A hard delete, unlike most of this schema: a hero slide is a placement,
     * not a record of something that happened, and there is nothing to audit in
     * the shape of "this garment used to lead the home page". The media assets
     * it pointed at survive — they are content-addressed and may be shared —
     * and are cleaned up on their own terms.
     */
    public function delete(string $publicId): void
    {
        $this->db->statement('DELETE FROM home_hero_slides WHERE public_id = ?', [$publicId]);
    }

    /** Where a new slide goes: last. */
    public function nextPosition(): int
    {
        $row = $this->db->selectOne('SELECT COALESCE(MAX(position), -1) AS last FROM home_hero_slides');

        return $row === null ? 0 : (int) $row['last'] + 1;
    }

    /**
     * Re-numbers the running order from a list of ids.
     *
     * The list is authoritative for the slides it names and silent about any it
     * does not, so a reorder racing a create cannot renumber the new slide to 0.
     *
     * @param list<string> $publicIds
     */
    public function reorder(array $publicIds): void
    {
        $now = $this->clock->nowString();

        foreach (array_values($publicIds) as $index => $publicId) {
            $this->db->statement(
                'UPDATE home_hero_slides SET position = ?, updated_at = ? WHERE public_id = ?',
                [$index, $now, $publicId],
            );
        }
    }

    public function count(): int
    {
        $row = $this->db->selectOne('SELECT COUNT(*) AS n FROM home_hero_slides');

        return $row === null ? 0 : (int) $row['n'];
    }
}

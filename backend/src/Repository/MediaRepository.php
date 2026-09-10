<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;

final class MediaRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /** @param array<string, mixed> $asset */
    public function insert(array $asset): int
    {
        /* `visibility` MUST be in this list.
           Migration 0034 added the column with a `'public'` default and a
           one-time backfill marking existing profile photos private. This INSERT
           was not updated to match, so every asset written AFTER that migration
           took the default — and the whole authorisation check in
           MediaController became decorative: a customer's face was world-readable
           the moment they uploaded it, and cached `public, immutable` on the way
           out. The column existing is not the control; writing it is. */
        return $this->db->insert(
            'INSERT INTO media_assets
                (public_id, owner_type, owner_id, visibility, storage_key, mime, bytes, width, height, checksum, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $asset['public_id'], $asset['owner_type'], $asset['owner_id'],
                self::visibilityFor((string) $asset['owner_type'], $asset['visibility'] ?? null),
                $asset['storage_key'],
                $asset['mime'], $asset['bytes'], $asset['width'], $asset['height'], $asset['checksum'],
                $this->clock->nowString(),
            ],
        );
    }

    /**
     * Which owner types are private, decided in ONE place.
     *
     * A default rather than a caller's choice, because the caller that gets it
     * wrong is the one that matters: `store()` is reached from the customer
     * photo endpoint and from console uploads through the same method, and an
     * omitted argument must not mean "public". An explicit value still wins, so
     * a future caller can mark something private that this list does not know
     * about; what it cannot do is accidentally publish a face.
     *
     * A new owner type defaults to PUBLIC deliberately — product photography is
     * the overwhelming majority of what this store holds and is meant to be
     * served to anyone. Anything holding personal data must be added here.
     */
    public static function visibilityFor(string $ownerType, ?string $explicit = null): string
    {
        if ($explicit === 'private' || $explicit === 'public') {
            return $explicit;
        }

        return in_array($ownerType, self::PRIVATE_OWNER_TYPES, true) ? 'private' : 'public';
    }

    /** Owner types whose assets are somebody's personal data, not catalogue. */
    private const PRIVATE_OWNER_TYPES = ['profile'];

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM media_assets WHERE public_id = ? AND deleted_at IS NULL LIMIT 1',
            [$publicId],
        );
    }

    /** @return array<string, mixed>|null */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne('SELECT * FROM media_assets WHERE id = ? AND deleted_at IS NULL LIMIT 1', [$id]);
    }

    /** Attaches an already-uploaded asset to the record that now owns it. */
    public function claim(int $mediaId, string $ownerType, ?int $ownerId): void
    {
        $this->db->statement(
            'UPDATE media_assets SET owner_type = ?, owner_id = ? WHERE id = ?',
            [$ownerType, $ownerId, $mediaId],
        );
    }

    public function softDelete(int $mediaId): void
    {
        $this->db->statement('UPDATE media_assets SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $mediaId]);
    }
}

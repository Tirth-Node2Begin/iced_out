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
        return $this->db->insert(
            'INSERT INTO media_assets
                (public_id, owner_type, owner_id, storage_key, mime, bytes, width, height, checksum, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $asset['public_id'], $asset['owner_type'], $asset['owner_id'], $asset['storage_key'],
                $asset['mime'], $asset['bytes'], $asset['width'], $asset['height'], $asset['checksum'],
                $this->clock->nowString(),
            ],
        );
    }

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

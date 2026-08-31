<?php

declare(strict_types=1);

namespace Iced\Repository\Crm;

use Iced\Kernel\Database;
use Iced\Support\Clock;

final class NoteRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly CrmIds $ids,
    ) {
    }

    /**
     * Pinned first, then newest. A pinned note is the one fact about this record
     * that must survive scrolling — "calls only after 6pm", "invoice to the
     * parent company" — so it never sinks below the chatter.
     *
     * @return list<array<string, mixed>>
     */
    public function forSubject(string $subjectType, int $subjectId): array
    {
        return $this->db->select(
            'SELECT n.*, u.name AS author_name, u.public_id AS author_public_id
               FROM crm_notes n
               LEFT JOIN users u ON u.id = n.author_user_id
              WHERE n.subject_type = ? AND n.subject_id = ? AND n.deleted_at IS NULL
              ORDER BY n.pinned DESC, n.created_at DESC',
            [$subjectType, $subjectId],
        );
    }

    /** @return array<string, mixed>|null */
    public function find(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT n.*, u.name AS author_name, u.public_id AS author_public_id
               FROM crm_notes n
               LEFT JOIN users u ON u.id = n.author_user_id
              WHERE n.public_id = ? AND n.deleted_at IS NULL
              LIMIT 1',
            [$publicId],
        );
    }

    public function create(string $subjectType, int $subjectId, string $body, bool $pinned, ?int $authorId): string
    {
        $publicId = $this->ids->mint('note');

        $this->db->insert(
            'INSERT INTO crm_notes
                (public_id, subject_type, subject_id, body, pinned, author_user_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $subjectType,
                $subjectId,
                $body,
                $pinned ? 1 : 0,
                $authorId,
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );

        return $publicId;
    }

    public function update(int $id, string $body, bool $pinned): void
    {
        $this->db->statement(
            'UPDATE crm_notes SET body = ?, pinned = ?, updated_at = ? WHERE id = ?',
            [$body, $pinned ? 1 : 0, $this->clock->nowString(), $id],
        );
    }

    public function softDelete(int $id): void
    {
        $this->db->statement('UPDATE crm_notes SET deleted_at = ? WHERE id = ?', [$this->clock->nowString(), $id]);
    }
}

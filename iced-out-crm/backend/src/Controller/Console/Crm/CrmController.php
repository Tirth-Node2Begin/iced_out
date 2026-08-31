<?php

declare(strict_types=1);

namespace Iced\Controller\Console\Crm;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;

/**
 * What every CRM controller needs and nothing else: who is acting, how a staff
 * public id becomes a row id, and how a record is stamped for the audit log.
 *
 * Not a service layer. These are four helpers that would otherwise be copied
 * into six controllers, and the moment one of them grows a decision it belongs
 * in a service instead.
 */
abstract class CrmController
{
    public function __construct(protected readonly Database $db)
    {
    }

    protected function actorId(Request $request): ?int
    {
        $principal = $request->attribute('principal');

        return $principal instanceof Principal ? $principal->userId : null;
    }

    /**
     * A staff public id (`usr-04`) to its row id.
     *
     * Three cases, and they mean different things:
     *   ''         → the caller did not mention an owner; leave it alone
     *   'me'       → the signed-in operator, so the UI never has to know its own id
     *   'none'     → deliberately unassigned
     */
    protected function ownerId(Request $request, string $value): ?int
    {
        $value = trim($value);

        if ($value === '' || $value === 'none' || $value === 'unassigned') {
            return null;
        }

        if ($value === 'me') {
            return $this->actorId($request);
        }

        $row = $this->db->selectOne(
            'SELECT id FROM users WHERE public_id = ? AND type = ? AND deleted_at IS NULL LIMIT 1',
            [$value, 'STAFF'],
        );

        if ($row === null) {
            throw new NotFoundException('ICE-CRM-404', 'That team member could not be found.');
        }

        return (int) $row['id'];
    }

    /** Names the record this request changed, for the audit middleware. */
    protected function audit(Request $request, string $entityType, string $entityId): void
    {
        $request->setAttribute('audit_entity_type', $entityType);
        $request->setAttribute('audit_entity_id', $entityId);
    }

    /**
     * Reads an optional string from the payload without letting `null` through
     * as the literal "". The validator has already checked shape; this is only
     * about a key being ABSENT (leave the column alone) versus present and blank
     * (clear the column) — a distinction every PATCH in this module depends on.
     *
     * @param array<string, mixed> $input
     */
    protected function has(array $input, string $key): bool
    {
        return array_key_exists($key, $input);
    }

    /** @param array<string, mixed> $input */
    protected function str(array $input, string $key, string $default = ''): string
    {
        $value = $input[$key] ?? null;

        return is_scalar($value) ? trim((string) $value) : $default;
    }

    /** @param array<string, mixed> $input */
    protected function int(array $input, string $key, int $default = 0): int
    {
        $value = $input[$key] ?? null;

        return is_numeric($value) ? (int) $value : $default;
    }

    /** @param array<string, mixed> $input */
    protected function bool(array $input, string $key, bool $default = false): bool
    {
        $value = $input[$key] ?? null;

        if (is_bool($value)) {
            return $value;
        }

        if (is_string($value)) {
            return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
        }

        return is_numeric($value) ? (int) $value === 1 : $default;
    }
}

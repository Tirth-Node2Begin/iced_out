<?php

declare(strict_types=1);

namespace Iced\Repository\Crm;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\ServiceUnavailableException;
use InvalidArgumentException;

/**
 * Public ids for the CRM tables — `lead-0007`, `deal-0012`, `cnt-0003`.
 *
 * The commerce side mints ids through Support\IdAllocator, which reads its
 * bounds from `store_settings.id_pools` because those ids had to line up with a
 * static export's pre-rendered pages. The CRM has no such constraint — its
 * screens read the id from the query string — so this is the same
 * lowest-free-first algorithm without the settings lookup.
 *
 * Lowest-free rather than MAX()+1 on purpose: deleting `lead-0004` and creating
 * the next lead should reuse 0004 rather than leaving a hole that makes an
 * operator wonder what they missed.
 */
final class CrmIds
{
    /** @var array<string, array{table: string, prefix: string, width: int}> */
    private const POOLS = [
        'lead' => ['table' => 'crm_leads', 'prefix' => 'lead-', 'width' => 4],
        'contact' => ['table' => 'crm_contacts', 'prefix' => 'cnt-', 'width' => 4],
        'company' => ['table' => 'crm_companies', 'prefix' => 'co-', 'width' => 4],
        'deal' => ['table' => 'crm_deals', 'prefix' => 'deal-', 'width' => 4],
        'activity' => ['table' => 'crm_activities', 'prefix' => 'act-', 'width' => 5],
        'note' => ['table' => 'crm_notes', 'prefix' => 'note-', 'width' => 5],
        'stage' => ['table' => 'crm_stages', 'prefix' => 'stage-', 'width' => 2],
        'pipeline' => ['table' => 'crm_pipelines', 'prefix' => 'pipe-', 'width' => 2],
    ];

    public function __construct(private readonly Database $db)
    {
    }

    public function mint(string $pool): string
    {
        if (!isset(self::POOLS[$pool])) {
            throw new InvalidArgumentException(sprintf('Unknown CRM id pool "%s".', $pool));
        }

        $spec = self::POOLS[$pool];

        /* Soft-deleted rows are INCLUDED — the unique index does not care that a
           row is archived, so reusing its id would collide. */
        $taken = [];

        foreach ($this->db->select(
            sprintf('SELECT public_id FROM %s WHERE public_id LIKE ?', $spec['table']),
            [$spec['prefix'] . '%'],
        ) as $row) {
            $taken[(string) $row['public_id']] = true;
        }

        for ($serial = 1; $serial <= 1_000_000; ++$serial) {
            $candidate = $spec['prefix'] . str_pad((string) $serial, $spec['width'], '0', STR_PAD_LEFT);

            if (!isset($taken[$candidate])) {
                return $candidate;
            }
        }

        throw new ServiceUnavailableException(sprintf('Could not mint a %s id — the sequence is saturated.', $pool));
    }
}

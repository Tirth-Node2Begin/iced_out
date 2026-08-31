<?php

declare(strict_types=1);

namespace Iced\Controller\Console\Crm;

use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CrmPresenter;
use Iced\Presenter\Format;
use Iced\Repository\Crm\ActivityRepository;
use Iced\Repository\Crm\ContactRepository;
use Iced\Repository\Crm\DealRepository;
use Iced\Repository\Crm\LeadRepository;

/**
 * The relationship half of the CRM home screen.
 *
 * Deliberately separate from the commerce dashboard the console already serves
 * at /admin/dashboard/*: those five endpoints answer "what does the shop owe
 * its customers today", these answer "what does the team owe its conversations".
 * The CRM home page calls both and lays them out as one screen.
 */
final class CrmDashboardController extends CrmController
{
    public function __construct(
        private readonly LeadRepository $leads,
        private readonly ContactRepository $contacts,
        private readonly DealRepository $deals,
        private readonly ActivityRepository $activities,
        private readonly CrmPresenter $presenter,
        Database $db,
    ) {
        parent::__construct($db);
    }

    /** GET /admin/crm/summary */
    public function summary(Request $request): Response
    {
        $pipeline = $this->deals->defaultPipeline();
        $board = $pipeline === null ? [] : $this->deals->summary((int) $pipeline['id']);
        $leadCounts = $this->leads->statusCounts();

        $won = (int) ($board['won_count'] ?? 0);
        $lost = (int) ($board['lost_count'] ?? 0);
        $settled = $won + $lost;

        return Response::data([
            'leads' => [
                'new' => $leadCounts['NEW'] ?? 0,
                'contacted' => $leadCounts['CONTACTED'] ?? 0,
                'qualified' => $leadCounts['QUALIFIED'] ?? 0,
                'converted' => $leadCounts['CONVERTED'] ?? 0,
                'open' => ($leadCounts['NEW'] ?? 0) + ($leadCounts['CONTACTED'] ?? 0) + ($leadCounts['QUALIFIED'] ?? 0),
            ],
            /* Cast to an object so an empty map encodes as `{}` and not `[]`.
               PHP cannot tell the two apart; JSON can, and a client reading
               `contacts.CUSTOMER` off an array gets a different kind of
               undefined than it does off an object. */
            'contacts' => (object) $this->contacts->lifecycleCounts(),
            'pipeline' => [
                'openCount' => (int) ($board['open_count'] ?? 0),
                'openValue' => '₹' . Format::groupIndian((int) round((float) ($board['open_value'] ?? 0))),
                'weightedValue' => '₹' . Format::groupIndian((int) round((float) ($board['weighted_value'] ?? 0))),
                'wonValue' => '₹' . Format::groupIndian((int) round((float) ($board['won_value'] ?? 0))),
                'winRate' => $settled === 0 ? null : (int) round($won / $settled * 100),
            ],
            /* Everyone's, then mine. The rail badge reads `mine.overdue`, because
               a number on your own navigation that counts someone else's work is
               a number you learn to ignore. */
            'tasks' => $this->activities->counts(),
            'mine' => $this->activities->counts($this->actorId($request)),
            'today' => $this->presenter->map(
                $this->activities->search([
                    'scope' => 'overdue',
                    'owner' => 'all',
                ]),
                'activity',
            ),
            'recentLeads' => $this->presenter->map(
                array_slice($this->leads->search(['status' => 'OPEN']), 0, 6),
                'lead',
            ),
        ]);
    }

    /**
     * GET /admin/crm/owners
     *
     * Staff accounts, for every owner picker in the module. One endpoint rather
     * than a field on each list payload, because the answer is the same on all
     * six screens and changes about twice a year.
     */
    public function owners(Request $request): Response
    {
        /* The role comes from a subquery rather than a JOIN: user_roles is
           many-to-many, and joining it would list an operator holding two roles
           twice in a picker that is supposed to name each person once. */
        $rows = $this->db->select(
            'SELECT u.public_id, u.name, u.email,
                    (SELECT r.code FROM user_roles ur
                       JOIN roles r ON r.id = ur.role_id
                      WHERE ur.user_id = u.id
                      ORDER BY r.id ASC LIMIT 1) AS role
               FROM users u
              WHERE u.type = ? AND u.status = ? AND u.deleted_at IS NULL
              ORDER BY u.name ASC',
            ['STAFF', 'ACTIVE'],
        );

        return Response::data([
            'owners' => array_map(static fn (array $row): array => [
                'id' => (string) $row['public_id'],
                'name' => (string) $row['name'],
                'email' => (string) $row['email'],
                'role' => (string) ($row['role'] ?? ''),
            ], $rows),
        ]);
    }
}

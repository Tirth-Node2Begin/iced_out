<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\Format;
use Iced\Repository\SettingsRepository;
use Iced\Repository\UserRepository;
use Iced\Service\Auth\PasswordHasher;
use Iced\Service\Auth\SessionManager;
use Iced\Support\Paginator;

/**
 * Spec §8.30 — settings and the staff member's own account (7 endpoints).
 *
 * Route note from the spec: the only settings PAGE on disk renders the signed-in
 * staff member's own details and password, which is what /admin/me/* below
 * serves. /admin/settings/store remains the policy value store that
 * pricing and checkout read internally — it just has no dedicated screen today.
 */
final class SettingsController
{
    public function __construct(
        private readonly SettingsRepository $settings,
        private readonly UserRepository $users,
        private readonly PasswordHasher $hasher,
        private readonly SessionManager $sessions,
    ) {
    }

    /** #170 GET /admin/settings/store */
    public function showStore(Request $request): Response
    {
        $all = $this->settings->all();

        $value = static fn (string $key): array => is_array($all[$key]['value'] ?? null) ? $all[$key]['value'] : [];

        return Response::data([
            'business' => $value('business'),
            'delivery' => $value('delivery'),
            'cod' => $value('cod'),
            'inventory' => $value('inventory'),
            'tax' => ['gstin' => $value('business')['gstin'] ?? '', 'rates' => $value('business')['tax_rates'] ?? []],
            'support_slas' => $value('support')['slas'] ?? [],
            'versions' => array_map(static fn (array $entry): int => (int) $entry['version'], $all),
        ]);
    }

    /** #171 PUT /admin/settings/store — versioned, audited. */
    public function updateStore(Request $request): Response
    {
        /** @var array<string, mixed> $body */
        $body = $request->body();

        $key = is_string($body['key'] ?? null) ? $body['key'] : '';
        $value = is_array($body['value'] ?? null) ? $body['value'] : null;
        $version = isset($body['version']) && is_numeric($body['version']) ? (int) $body['version'] : null;

        if ($key === '' || $value === null) {
            throw ValidationException::field('key', 'Name the setting and give it a value.', 'ICE-SYS-422');
        }

        $existing = $this->settings->get($key);

        $request->setAttribute('audit_entity_type', 'setting');
        $request->setAttribute('audit_entity_id', $key);
        $request->setAttribute('audit_before', $existing);

        if (!$this->settings->put($key, $value, $existing === null ? null : $version, $this->actor($request)->userId)) {
            throw new ConflictException(
                'ICE-SYS-409',
                'Those settings changed while you were editing. Reload and try again.',
            );
        }

        $updated = $this->settings->get($key);
        $request->setAttribute('audit_after', $updated);

        return Response::data($updated ?? []);
    }

    /** #172 GET /admin/me/profile */
    public function profile(Request $request): Response
    {
        $user = $this->users->findById($this->actor($request)->userId);

        return Response::data($this->staffProfile($user ?? []));
    }

    /** #173 PUT /admin/me/profile */
    public function updateProfile(Request $request): Response
    {
        $actor = $this->actor($request);
        /** @var array{name?: string, phone?: string} $input */
        $input = $request->validated();

        $fields = [];

        foreach (['name' => 'name', 'phone' => 'phone'] as $key => $column) {
            if (isset($input[$key])) {
                $fields[$column] = $input[$key];
            }
        }

        $this->users->updateProfile($actor->userId, $fields);

        $user = $this->users->findById($actor->userId);

        return Response::data($this->staffProfile($user ?? []));
    }

    /** #174 POST /admin/me/password — rotates every other session. */
    public function changePassword(Request $request): Response
    {
        $actor = $this->actor($request);
        /** @var array{current: string, next: string} $input */
        $input = $request->validated();

        $user = $this->users->findById($actor->userId);

        if ($user === null || !$this->hasher->verify($input['current'], (string) $user['password_hash'])) {
            throw ValidationException::field('current', 'That is not your current password.', 'ICE-AUTH-422');
        }

        if ($input['current'] === $input['next']) {
            throw ValidationException::field('next', 'Choose a password you have not used here before.', 'ICE-AUTH-422');
        }

        $this->users->updatePasswordHash($actor->userId, $this->hasher->hash($input['next']));

        // Everything else signed in as this account is now stale.
        $this->sessions->revokeOtherSessions($actor->userId, SessionManager::AUDIENCE_STAFF, $actor->sessionId);

        return Response::noContent();
    }

    /** #175 GET /admin/me/activity — 5 rows on the page, 12 in the dialog. */
    public function activity(Request $request): Response
    {
        $actor = $this->actor($request);
        $page = Paginator::fromRequest($request, 5);

        $rows = $this->settings->staffActivity($actor->userId, $page->perPage, $page->offset());
        $total = $this->settings->countStaffActivity($actor->userId);

        return Response::paginated(array_map(static function (array $row): array {
            $at = Format::parse((string) $row['created_at']);

            return [
                'id' => (string) $row['id'],
                'when' => $at === null ? '' : Format::ledgerStamp($at),
                'day' => $at === null ? '' : Format::longDate($at),
                'action' => (string) $row['action'],
                'resource' => (string) $row['resource'],
                'where' => (string) $row['where_label'],
                'result' => (string) $row['result'],
            ];
        }, $rows), $page->meta($total));
    }

    /** #176 GET /admin/audit-logs — permission `audit.view`. */
    public function auditLogs(Request $request): Response
    {
        $page = Paginator::fromRequest($request);

        $rows = $this->settings->auditLogs([
            'entity' => $request->queryString('entity'),
            'actor' => $request->queryString('actor'),
        ], $page->perPage, $page->offset());

        return Response::data(array_map(static function (array $row): array {
            $at = Format::parse((string) $row['created_at']);

            return [
                'id' => (string) $row['id'],
                'actor' => (string) ($row['actor_name'] ?? 'System'),
                'role' => (string) $row['actor_role'],
                'permission' => (string) $row['permission_used'],
                'action' => (string) $row['action'],
                'entity' => trim(sprintf('%s %s', $row['entity_type'], $row['entity_id'])),
                'requestId' => (string) $row['request_id'],
                'at' => $at === null ? '' : Format::ledgerStamp($at),
            ];
        }, $rows));
    }

    /**
     * @param array<string, mixed> $user
     *
     * @return array{name: string, email: string, phone: string, photo: string|null}
     */
    private function staffProfile(array $user): array
    {
        $photo = $user['photo_key'] ?? null;

        return [
            'name' => (string) ($user['name'] ?? ''),
            'email' => (string) ($user['email'] ?? ''),
            'phone' => (string) ($user['phone'] ?? ''),
            'photo' => is_string($photo) && $photo !== '' ? '/media/' . $photo : null,
        ];
    }

    private function actor(Request $request): Principal
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException();
        }

        return $principal;
    }
}

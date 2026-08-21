<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CustomerPresenter;
use Iced\Presenter\Format;
use Iced\Repository\AddressRepository;
use Iced\Repository\SessionRepository;
use Iced\Repository\UserRepository;
use Iced\Service\Auth\PasswordHasher;
use Iced\Service\Auth\SessionManager;
use Iced\Service\Media\MediaService;
use Iced\Support\Validator;

/** Spec §8.3 profile (9) and §8.4 addresses (5) — the account area's own API. */
final class ProfileController
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly AddressRepository $addresses,
        private readonly SessionRepository $sessions,
        private readonly CustomerPresenter $presenter,
        private readonly PasswordHasher $hasher,
        private readonly SessionManager $sessionManager,
        private readonly MediaService $media,
        private readonly Database $db,
    ) {
    }

    /** #15 GET /me */
    public function show(Request $request): Response
    {
        return Response::data($this->presenter->profile($this->user($request)));
    }

    /** #16 PATCH /me — an email change re-checks uniqueness. */
    public function update(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array{name?: string, email?: string, mobile?: string} $input */
        $input = $request->validated();

        $fields = [];

        if (isset($input['name'])) {
            $fields['name'] = $input['name'];
        }

        if (isset($input['mobile'])) {
            $normalized = Validator::normalizeMobile($input['mobile']);

            if ($normalized === null) {
                throw ValidationException::field('mobile', 'Enter a 10-digit Indian mobile number.', 'ICE-USR-422');
            }

            $fields['phone'] = $normalized;
        }

        if (isset($input['email'])) {
            $existing = $this->users->findByEmail($input['email'], UserRepository::TYPE_CUSTOMER);

            if ($existing !== null && (int) $existing['id'] !== $principal->userId) {
                throw ValidationException::field('email', 'An account with that email already exists.', 'ICE-USR-422');
            }

            $fields['email'] = trim($input['email']);
            $fields['email_normalized'] = UserRepository::normalizeEmail($input['email']);
        }

        $this->users->updateProfile($principal->userId, $fields);

        return Response::data($this->presenter->profile($this->user($request)));
    }

    /** #17 PUT /me/photo */
    public function uploadPhoto(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array<string, mixed> $files */
        $files = $request->files;
        /** @var array<string, mixed> $file */
        $file = $files['photo'] ?? $files['file'] ?? [];

        $stored = $this->media->store($file, 'profile', $principal->userId, 'media.max_bytes_customer');
        $asset = $this->db->selectOne('SELECT id FROM media_assets WHERE public_id = ?', [$stored['media_id']]);

        if ($asset !== null) {
            $this->users->updateProfile($principal->userId, ['photo_media_id' => (int) $asset['id']]);
        }

        return Response::data($this->presenter->profile($this->user($request)));
    }

    /** #18 DELETE /me/photo */
    public function deletePhoto(Request $request): Response
    {
        $this->users->updateProfile($this->principal($request)->userId, ['photo_media_id' => null]);

        return Response::data($this->presenter->profile($this->user($request)));
    }

    /** #19 POST /me/password — rotates every other session. */
    public function changePassword(Request $request): Response
    {
        $principal = $this->principal($request);
        /** @var array{current: string, next: string} $input */
        $input = $request->validated();

        $user = $this->users->findById($principal->userId);

        if ($user === null || !$this->hasher->verify($input['current'], (string) $user['password_hash'])) {
            throw ValidationException::field('current', 'That is not your current password.', 'ICE-AUTH-422');
        }

        $this->users->updatePasswordHash($principal->userId, $this->hasher->hash($input['next']));
        $this->sessionManager->revokeOtherSessions($principal->userId, SessionManager::AUDIENCE_CUSTOMER, $principal->sessionId);

        return Response::noContent();
    }

    /** #20 GET /me/sessions */
    public function sessions(Request $request): Response
    {
        $principal = $this->principal($request);

        return Response::data(array_map(static function (array $row) use ($principal): array {
            $created = Format::parse((string) $row['created_at']);
            $active = Format::parse((string) $row['last_active_at']);

            return [
                'id' => (string) $row['id'],
                'created_at' => $created === null ? '' : Format::ledgerStamp($created),
                'last_active_at' => $active === null ? '' : Format::ledgerStamp($active),
                'ip' => (string) ($row['ip'] ?? ''),
                'user_agent' => (string) $row['user_agent'],
                'current' => (int) $row['id'] === $principal->sessionId,
            ];
        }, $this->sessions->listForUser($principal->userId, SessionManager::AUDIENCE_CUSTOMER)));
    }

    /** #21 DELETE /me/sessions/{id} */
    public function revokeSession(Request $request): Response
    {
        $principal = $this->principal($request);
        $id = (int) $request->routeParam('id');

        foreach ($this->sessions->listForUser($principal->userId, SessionManager::AUDIENCE_CUSTOMER) as $row) {
            if ((int) $row['id'] === $id) {
                $this->sessions->revoke($id);

                return Response::noContent();
            }
        }

        throw new NotFoundException('ICE-AUTH-404', 'We could not find that session.');
    }

    /** #22 POST /me/sessions/revoke-others */
    public function revokeOtherSessions(Request $request): Response
    {
        $principal = $this->principal($request);
        $this->sessionManager->revokeOtherSessions($principal->userId, SessionManager::AUDIENCE_CUSTOMER, $principal->sessionId);

        return Response::noContent();
    }

    /* ------------------------------------------------------------ addresses */

    /** #24 GET /me/addresses */
    public function addresses(Request $request): Response
    {
        $principal = $this->principal($request);

        return Response::data($this->presenter->addressBook($this->addresses->forUser($principal->userId)));
    }

    /** #25 POST /me/addresses */
    public function createAddress(Request $request): Response
    {
        $principal = $this->principal($request);
        $fields = $this->addressFields($request->validated());

        return $this->db->transaction(function () use ($principal, $fields, $request): Response {
            $publicId = $this->addresses->nextPublicId();
            $existing = $this->addresses->forUser($principal->userId);

            $this->addresses->insert($principal->userId, $publicId, $fields + ['position' => count($existing)]);

            /** @var array<string, mixed> $input */
            $input = $request->validated();

            // The first address a shopper saves is their default whether they
            // asked for it or not — a book with no default has nothing for
            // checkout to pre-select.
            if ($existing === [] || (bool) ($input['makeDefault'] ?? false)) {
                $this->addresses->makeDefault($principal->userId, $publicId);
            }

            $row = $this->addresses->find($principal->userId, $publicId);

            return Response::data($row === null ? [] : $this->presenter->address($row), 201);
        });
    }

    /** #26 PATCH /me/addresses/{id} */
    public function updateAddress(Request $request): Response
    {
        $principal = $this->principal($request);
        $publicId = $request->routeParam('id');
        $this->findAddress($principal->userId, $publicId);

        /** @var array<string, mixed> $input */
        $input = $request->validated();
        $fields = $this->addressFields($input, false);

        $this->addresses->update($principal->userId, $publicId, $fields);

        if ((bool) ($input['makeDefault'] ?? false)) {
            $this->addresses->makeDefault($principal->userId, $publicId);
        }

        $row = $this->addresses->find($principal->userId, $publicId);

        return Response::data($row === null ? [] : $this->presenter->address($row));
    }

    /** #27 DELETE /me/addresses/{id} — deleting the default promotes the next. */
    public function deleteAddress(Request $request): Response
    {
        $principal = $this->principal($request);
        $publicId = $request->routeParam('id');
        $this->findAddress($principal->userId, $publicId);

        return $this->db->transaction(function () use ($principal, $publicId): Response {
            $this->addresses->softDelete($principal->userId, $publicId);
            $this->addresses->promoteIfNoDefault($principal->userId);

            return Response::noContent();
        });
    }

    /** #28 POST /me/addresses/{id}/default */
    public function makeAddressDefault(Request $request): Response
    {
        $principal = $this->principal($request);
        $publicId = $request->routeParam('id');
        $this->findAddress($principal->userId, $publicId);

        $this->addresses->makeDefault($principal->userId, $publicId);

        return Response::noContent();
    }

    /**
     * @param array<string, mixed> $input
     *
     * @return array<string, mixed>
     */
    private function addressFields(array $input, bool $requireAll = true): array
    {
        $fields = [];
        $map = [
            'label' => 'label',
            'name' => 'name',
            'street' => 'street',
            'city' => 'city',
            'state' => 'state',
            'pincode' => 'pincode',
        ];

        foreach ($map as $key => $column) {
            if (array_key_exists($key, $input)) {
                $fields[$column] = (string) $input[$key];
            } elseif ($requireAll) {
                $fields[$column] = '';
            }
        }

        if (array_key_exists('phone', $input)) {
            $normalized = Validator::normalizeMobile((string) $input['phone']);

            if ($normalized === null) {
                throw ValidationException::field('phone', 'Enter a 10-digit Indian mobile number.', 'ICE-USR-422');
            }

            $fields['phone'] = $normalized;
        } elseif ($requireAll) {
            $fields['phone'] = '';
        }

        return $fields;
    }

    /** @return array<string, mixed> */
    private function findAddress(int $userId, string $publicId): array
    {
        $row = $this->addresses->find($userId, $publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-USR-404', 'We could not find that address.');
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function user(Request $request): array
    {
        $user = $this->users->findById($this->principal($request)->userId);

        if ($user === null) {
            throw new UnauthorizedException();
        }

        return $user;
    }

    private function principal(Request $request): Principal
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException();
        }

        return $principal;
    }
}

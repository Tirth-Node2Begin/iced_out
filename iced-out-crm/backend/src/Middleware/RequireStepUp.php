<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\ApiException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;
use Iced\Repository\SessionRepository;
use Iced\Support\Clock;
use Iced\Support\SecuritySignals;

/**
 * The password again, for the few actions where a session is not enough.
 *
 * ── WHAT PROBLEM THIS ACTUALLY SOLVES ───────────────────────────────────────
 *
 * A console session is a fifteen-minute idle window in which every permission
 * the account holds is available with no further proof. For most of the console
 * that is exactly right: somebody moving twenty orders through dispatch should
 * not retype a password twenty times, and making them would produce a team that
 * types its password into anything that asks.
 *
 * It is not right for the handful of actions that move money or change who can
 * act. An unattended laptop for two minutes is enough to approve a refund, mark
 * a payout paid, or rewrite the store settings that govern session lifetimes and
 * lockout thresholds — and the audit trail would record, correctly and uselessly,
 * that the account did it.
 *
 * So those actions ask for the password again. That is all this is: not a second
 * factor, and it does not pretend to be one. It proves the person at the keyboard
 * knows the credential, which is the thing a borrowed session does not carry.
 * MFA is the stronger answer and is a separate piece of work.
 *
 * ── WHERE IT SITS, AND WHY ──────────────────────────────────────────────────
 *
 * AFTER `Authorize`. A caller who lacks the permission entirely must be told
 * that — not invited to re-enter their password for something they could never
 * do anyway, which would leak which actions exist and turn this into a password
 * prompt an attacker can summon at will.
 *
 * ── THE ERROR IS ITS OWN CODE ───────────────────────────────────────────────
 *
 * `ICE-AUTH-428` on HTTP 428 Precondition Required, which is what that status is
 * for. It is deliberately not 401: a 401 would send the console's own
 * interceptor to the sign-out path, throwing away a perfectly good session
 * because one action wanted a fresh password. The frontend shows a prompt and
 * retries.
 */
final class RequireStepUp implements Middleware
{
    /**
     * How long an elevation lasts.
     *
     * Long enough to approve a handful of refunds in one sitting; short enough
     * that walking away from the desk ends it. Not configurable, because the
     * setting that would configure it is itself behind a step-up.
     */
    public const WINDOW_SECONDS = 600;

    public function __construct(
        private readonly SessionRepository $sessions,
        private readonly SecuritySignals $signals,
        private readonly Clock $clock,
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        $route = $request->attribute('route');

        if (!$route instanceof Route || !$route->stepUp) {
            return $next($request);
        }

        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            /* FAIL CLOSED. This used to `return $next($request)` on the
               reasoning that a step-up route is always a staff route, so
               `Authenticate` has already refused anyone without a session — true
               of all four routes that set the flag today.

               But the default for a security control must not be "allow", and
               the invariant it relied on lives in a different file: one
               `AUDIENCE_PUBLIC` route with `'step_up' => true` would silently
               turn this middleware off for that route, with nothing to notice.
               A control that is disabled by an edit elsewhere is not a control. */
            throw new ApiException(
                428,
                'ICE-AUTH-428',
                'Confirm your password to continue.',
                [['field' => 'password', 'detail' => 'This action needs your password again.']],
            );
        }

        if (!$this->sessions->isSteppedUp($principal->sessionId, self::WINDOW_SECONDS)) {
            throw new ApiException(
                428,
                'ICE-AUTH-428',
                'Confirm your password to continue.',
                [['field' => 'password', 'detail' => 'This action needs your password again.']],
            );
        }

        /* Recorded whether or not anyone is watching. These are the actions an
           investigation starts from, and the audit row alone does not say that
           the password was re-proved at the time. */
        $this->signals->privilegedAction('step_up_used', [
            'route' => $route->name ?? ($route->method . ' ' . $route->path),
            'actor' => $principal->publicId,
            'request_id' => $request->requestId(),
        ]);

        return $next($request);
    }
}

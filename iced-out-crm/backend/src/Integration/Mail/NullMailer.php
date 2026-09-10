<?php

declare(strict_types=1);

namespace Iced\Integration\Mail;

/**
 * The mailer bound in production when no real one is configured.
 *
 * It exists so that a misconfiguration FAILS rather than leaks. The alternative
 * — falling back to `LogMailer` — writes every message into storage/logs
 * including the six digits of a password-reset code, in a directory that under
 * the flat cPanel layout is inside the document root.
 *
 * Sending nothing is the honest behaviour: nobody receives a code they cannot
 * use, `isConfigured()` says false so callers can report it, and
 * `GET /ready` marks the store unhealthy until SMTP is set up. A shop that
 * cannot email is a problem somebody notices and fixes within the hour. A shop
 * silently writing recovery codes to a servable file is not.
 *
 * `send()` does not throw. The callers of this — password reset, account
 * notices — already treat a failed send as non-fatal, and turning a
 * configuration gap into a 500 on the recovery endpoint would take the account
 * area down as well as the mail.
 */
final class NullMailer implements Mailer
{
    public function send(MailMessage $message): void
    {
        // Deliberately nothing. Not even a log line: the subject alone would
        // pair an address with "your password was reset".
    }

    public function isConfigured(): bool
    {
        return false;
    }

    public function name(): string
    {
        return 'none';
    }
}

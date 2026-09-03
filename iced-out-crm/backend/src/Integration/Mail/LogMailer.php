<?php

declare(strict_types=1);

namespace Iced\Integration\Mail;

use Iced\Support\Logger;

/**
 * MAIL_DRIVER=log — the development default.
 *
 * Writes the whole message, plain-text body included, to storage/logs. That is
 * deliberate and it is why this driver must never be the one running in
 * production: a recovery code in a log file is a recovery code anyone with the
 * log has. The `mail.driver` warning in `GET /ready` is the reminder.
 *
 * It exists so the flow is exercisable end to end on a laptop with no SMTP
 * credentials at all — `php bin/console.php` and a `tail` on the log is the
 * whole inbox.
 */
final class LogMailer implements Mailer
{
    public function __construct(private readonly Logger $logger)
    {
    }

    public function send(MailMessage $message): void
    {
        $this->logger->info('mail.sent', [
            'driver' => 'log',
            'to' => $message->to,
            'subject' => $message->subject,
            'body' => $message->text,
        ]);
    }

    public function isConfigured(): bool
    {
        return true;
    }

    public function name(): string
    {
        return 'log';
    }
}

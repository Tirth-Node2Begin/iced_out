<?php

declare(strict_types=1);

namespace Iced\Integration\Mail;

/**
 * Sends one message, or throws MailFailed trying.
 *
 * Two implementations, chosen by MAIL_DRIVER in Application::boot: SmtpMailer
 * talks to a real server, LogMailer writes the message to storage/logs. The
 * same arrangement as the background remover — a blank credential binds the
 * honest do-nothing rather than a client that cannot connect.
 */
interface Mailer
{
    public function send(MailMessage $message): void;

    /** False when nothing was configured — the caller decides whether that is fatal. */
    public function isConfigured(): bool;

    /** For logs: "smtp.gmail.com:587" or "log". */
    public function name(): string;
}

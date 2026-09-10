<?php

declare(strict_types=1);

namespace Iced\Service\Auth;

use Iced\Integration\Mail\MailMessage;
use Iced\Integration\Mail\Mailer;
use Iced\Support\Logger;
use Throwable;

/**
 * "Was that you?" — the messages that make an account takeover visible.
 *
 * Nothing in this application told a shopper when their credentials changed. A
 * password reset, a password change, an email change and a session revocation
 * all happened in silence, so somebody who got into an account once could keep
 * it, and the owner's first sign that anything had happened was being unable to
 * sign in.
 *
 * These do not PREVENT anything. Their whole value is the hour between "someone
 * changed your email" landing in an inbox and the attacker being able to use
 * what they took — an hour the account holder currently does not get.
 *
 * ── WHERE EACH ONE IS SENT ──────────────────────────────────────────────────
 *
 * To the address that can still act on the news. For an email change that is the
 * PREVIOUS address, not the new one: telling the new address is telling whoever
 * asked for the change, which is exactly the wrong person if this was not the
 * owner.
 *
 * ── NOTHING HERE IS A LINK, AND NOTHING HERE IS A SECRET ────────────────────
 *
 * No reset URL, no button, no token, no code — the same rule the recovery mail
 * follows, for the same reason: a notice that trains people to click is a notice
 * that trains them to be phished. These say what happened and tell the reader to
 * go to the site themselves.
 *
 * The new email address is deliberately shown in full in the one message that
 * needs it, because "your email was changed" without saying to what leaves the
 * reader nothing to check.
 *
 * ── FAILURE IS NEVER THE CALLER'S PROBLEM ───────────────────────────────────
 *
 * Every method swallows its exception and logs. A notice is a courtesy about
 * something that has ALREADY happened; an SMTP timeout must not roll back a
 * password change the shopper has been shown, and must not turn a successful
 * request into a 500.
 */
final class AccountNotices
{
    public function __construct(
        private readonly Mailer $mailer,
        private readonly Logger $logger,
        private readonly string $storeName = 'Iced_out',
    ) {
    }

    /** Sent to the OLD address — the one that can still say "that was not me". */
    public function emailChanged(string $previousEmail, string $newEmail, string $name): void
    {
        $this->notify(
            $previousEmail,
            sprintf('%s — the email on your account was changed', $this->storeName),
            $name,
            sprintf('The email address on your %s account was changed to %s.', $this->storeName, $newEmail),
            'If that was not you, someone else has access to your account. Change your password immediately '
                . 'and contact support from the address you can still reach.',
        );
    }

    public function passwordChanged(string $email, string $name): void
    {
        $this->notify(
            $email,
            sprintf('%s — your password was changed', $this->storeName),
            $name,
            sprintf('The password on your %s account was just changed, and every other signed-in device was signed out.', $this->storeName),
            'If that was not you, use "forgot password" on the site to take the account back, and contact support.',
        );
    }

    public function passwordReset(string $email, string $name): void
    {
        $this->notify(
            $email,
            sprintf('%s — your password was reset', $this->storeName),
            $name,
            sprintf('The password on your %s account was reset using an emailed code, and every session was signed out.', $this->storeName),
            'If that was not you, contact support straight away — someone has access to this mailbox.',
        );
    }

    public function sessionsRevoked(string $email, string $name, int $count): void
    {
        if ($count < 1) {
            return;
        }

        $this->notify(
            $email,
            sprintf('%s — other devices were signed out', $this->storeName),
            $name,
            sprintf('%d other signed-in device%s on your %s account %s signed out.', $count, $count === 1 ? '' : 's', $this->storeName, $count === 1 ? 'was' : 'were'),
            'If that was not you, change your password — it is the only thing that ends a session somebody else started.',
        );
    }

    /**
     * The message, in both parts, and never allowed to fail the request.
     *
     * Plain and table-free: these are short, and a notice that arrives looking
     * like marketing is a notice that gets filtered.
     */
    private function notify(string $to, string $subject, string $name, string $what, string $advice): void
    {
        if ($to === '') {
            return;
        }

        $greeting = $name === '' ? 'Hello,' : sprintf('Hi %s,', $name);

        $text = implode("\n\n", [$greeting, $what, $advice, sprintf('— %s', $this->storeName)]);

        $html = sprintf(
            '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#101113">'
                . '<p>%s</p><p>%s</p><p style="color:#6b7280">%s</p><p style="color:#6b7280">— %s</p></div>',
            htmlspecialchars($greeting, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($what, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($advice, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($this->storeName, ENT_QUOTES, 'UTF-8'),
        );

        try {
            $this->mailer->send(new MailMessage($to, $subject, $text, $html));
        } catch (Throwable $error) {
            /* The address is not logged. These notices go to people whose
               accounts are in the middle of a security event, and a log line
               pairing an address with "password changed" is a small breach of
               its own if the log is ever read by the wrong person. */
            $this->logger->warning('account.notice_failed', [
                'subject' => $subject,
                'detail' => $error->getMessage(),
            ]);
        }
    }
}

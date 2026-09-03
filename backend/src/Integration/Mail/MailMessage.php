<?php

declare(strict_types=1);

namespace Iced\Integration\Mail;

/**
 * One outbound email, transport-agnostic.
 *
 * Both a text and an HTML body are required rather than optional. A recovery
 * code that only exists inside a `<div>` is a code the recipient cannot read in
 * a plain-text client, in a notification preview, or in the log driver — and
 * the whole point of the message is that six digits arrive legibly.
 */
final class MailMessage
{
    public function __construct(
        public readonly string $to,
        public readonly string $subject,
        public readonly string $text,
        public readonly string $html,
    ) {
    }
}

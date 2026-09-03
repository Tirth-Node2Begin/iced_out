<?php

declare(strict_types=1);

namespace Iced\Integration\Mail;

use RuntimeException;

/**
 * The transport could not hand the message over.
 *
 * Never surfaced verbatim to a browser: an SMTP server's refusal names the
 * mailbox it refused, which is exactly the account-existence signal the
 * recovery endpoints are built not to leak. Callers log it and answer neutrally.
 */
final class MailFailed extends RuntimeException
{
}

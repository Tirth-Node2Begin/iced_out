<?php

declare(strict_types=1);

namespace Iced\Support;

use Throwable;

/**
 * JSON-lines logger. Stack traces land here and never in an HTTP response
 * (spec §14) — the client only ever gets a request_id to quote.
 */
final class Logger
{
    public function __construct(
        private readonly string $directory,
        private readonly Clock $clock,
    ) {
    }

    /** @param array<string, mixed> $context */
    public function info(string $message, array $context = []): void
    {
        $this->write('info', $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function warning(string $message, array $context = []): void
    {
        $this->write('warning', $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function error(string $message, array $context = []): void
    {
        $this->write('error', $message, $context);
    }

    /** @param array<string, mixed> $context */
    public function exception(Throwable $error, array $context = []): void
    {
        $this->write('error', $error->getMessage(), $context + [
            'exception' => $error::class,
            'file' => $error->getFile() . ':' . $error->getLine(),
            'trace' => $error->getTraceAsString(),
        ]);
    }

    /**
     * Context keys whose VALUES never reach a log file.
     *
     * There was no redaction here at all: whatever a caller put in the context
     * array was JSON-encoded verbatim. That is fine for as long as everybody
     * remembers, and log files are exactly where "everybody remembers" fails —
     * they are append-only, long-lived, copied into bug reports, and under the
     * flat cPanel layout they sit inside the document root.
     *
     * Matching is on the KEY, case-insensitively and by substring, so
     * `db_pass`, `DB_PASSWORD` and `smtp_password` are all caught by `pass`.
     * Cheap, and it errs towards redacting something harmless rather than
     * printing something that matters.
     *
     * `body` is deliberately NOT here. The log mailer writes the whole recovery
     * email into the context under that key, and reading the code out of the log
     * is the entire reason that driver exists on a laptop with no SMTP. It is
     * kept safe by refusing to bind that driver in production at all — see
     * Application::boot — rather than by making it useless everywhere.
     */
    private const REDACT = [
        'password', 'passwd', 'pass', 'secret', 'token', 'signature', 'authorization',
        'cookie', 'otp', 'pepper', 'credential', 'api_key', 'apikey', 'private',
    ];

    /** Redacted, but only where a short value could BE the thing. */
    private const REDACT_IF_SHORT = ['code', 'key'];

    private const MASK = '[redacted]';

    /**
     * Replaces anything that looks like a credential, at any depth.
     *
     * Recursion is bounded: a context array deep enough to matter is a bug in
     * the caller, and a logger that recurses forever turns a log line into an
     * outage.
     *
     * @param array<array-key, mixed> $context
     *
     * @return array<array-key, mixed>
     */
    private function redact(array $context, int $depth = 0): array
    {
        if ($depth > 6) {
            return ['_' => 'context too deep to log'];
        }

        $clean = [];

        foreach ($context as $key => $value) {
            $name = strtolower((string) $key);

            $sensitive = false;

            foreach (self::REDACT as $needle) {
                if (str_contains($name, $needle)) {
                    $sensitive = true;

                    break;
                }
            }

            /* `code` is both an error code and a one-time password, and `key` is
               both an idempotency key and a credential. A long value under those
               names is an identifier worth keeping; a short one could be the
               secret itself, so it goes. */
            if (!$sensitive) {
                foreach (self::REDACT_IF_SHORT as $needle) {
                    if (str_contains($name, $needle) && is_scalar($value) && mb_strlen((string) $value) <= 12) {
                        $sensitive = true;

                        break;
                    }
                }
            }

            if ($sensitive) {
                $clean[$key] = self::MASK;

                continue;
            }

            $clean[$key] = is_array($value) ? $this->redact($value, $depth + 1) : $value;
        }

        return $clean;
    }

    /** @param array<string, mixed> $context */
    private function write(string $level, string $message, array $context): void
    {
        if (!is_dir($this->directory)) {
            @mkdir($this->directory, 0775, true);
        }

        $line = json_encode([
            'at' => $this->clock->nowString(),
            'level' => $level,
            'message' => $message,
        ] + $this->redact($context), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);

        if ($line === false) {
            return;
        }

        $file = $this->directory . '/app-' . gmdate('Y-m-d') . '.log';
        @file_put_contents($file, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}

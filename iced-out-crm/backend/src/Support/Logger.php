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
        ] + $context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);

        if ($line === false) {
            return;
        }

        $file = $this->directory . '/app-' . gmdate('Y-m-d') . '.log';
        @file_put_contents($file, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}

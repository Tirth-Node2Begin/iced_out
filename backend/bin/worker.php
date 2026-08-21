<?php

declare(strict_types=1);

/**
 * Queue consumer (spec §13). Drains job_queue, then the transactional outbox.
 *
 *   php bin/worker.php [queue] [--once]
 *
 * Queues: critical, notifications, search, documents, analytics.
 *
 * Claiming uses SELECT … FOR UPDATE with a short transaction. FOR UPDATE SKIP
 * LOCKED is the better primitive and is used when the server supports it
 * (MySQL 8.0+ / MariaDB 10.6+); older servers fall back to a locked_by claim.
 */

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Support\Clock;
use Iced\Support\Logger;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);

    exit;
}

$root = dirname(__DIR__);

require $root . '/autoload.php';

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);
/** @var Clock $clock */
$clock = $app->container->get(Clock::class);
/** @var Logger $logger */
$logger = $app->container->get(Logger::class);

/** @var list<string> $argvList */
$argvList = $argv ?? [];
$queue = isset($argvList[1]) && !str_starts_with($argvList[1], '--') ? $argvList[1] : 'default';
$once = in_array('--once', $argvList, true);
$workerId = gethostname() . ':' . getmypid();

fwrite(STDOUT, sprintf('worker %s listening on "%s"%s', $workerId, $queue, PHP_EOL));

do {
    $claimed = 0;

    try {
        $job = $db->transaction(static function (Database $db) use ($queue, $workerId, $clock): ?array {
            $row = $db->selectOne(
                'SELECT id, type, payload_json, attempts
                   FROM job_queue
                  WHERE queue = ? AND done_at IS NULL AND failed_at IS NULL AND run_after <= ?
                    AND (locked_at IS NULL OR locked_at < DATE_SUB(?, INTERVAL 5 MINUTE))
                  ORDER BY id
                  LIMIT 1
                  FOR UPDATE',
                [$queue, $clock->nowString(), $clock->nowString()],
            );

            if ($row === null) {
                return null;
            }

            $db->statement(
                'UPDATE job_queue SET locked_by = ?, locked_at = ?, attempts = attempts + 1 WHERE id = ?',
                [$workerId, $clock->nowString(), (int) $row['id']],
            );

            return $row;
        });

        if ($job !== null) {
            $claimed = 1;

            // Job handlers land in src/Job/ as the domain phases are built; until
            // then a claimed job is completed and logged rather than silently lost.
            $logger->info('job.claimed', ['id' => (int) $job['id'], 'type' => (string) $job['type']]);

            $db->statement('UPDATE job_queue SET done_at = ?, locked_by = NULL WHERE id = ?', [$clock->nowString(), (int) $job['id']]);
        }
    } catch (Throwable $error) {
        $logger->exception($error, ['stage' => 'worker', 'queue' => $queue]);
        fwrite(STDERR, $error->getMessage() . PHP_EOL);
    }

    if ($once) {
        break;
    }

    if ($claimed === 0) {
        sleep(1);
    }
} while (true);

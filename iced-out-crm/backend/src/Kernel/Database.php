<?php

declare(strict_types=1);

namespace Iced\Kernel;

use Iced\Support\Config;
use PDO;
use PDOException;
use Throwable;

/**
 * The only place a PDO handle is created. Prepared statements always, emulation
 * off, exceptions on (spec §14). Repositories take this, never a raw PDO.
 */
final class Database
{
    private ?PDO $pdo = null;

    private int $transactionDepth = 0;

    public function __construct(private readonly Config $config)
    {
    }

    public function pdo(): PDO
    {
        if ($this->pdo instanceof PDO) {
            return $this->pdo;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $this->config->string('database.host', '127.0.0.1'),
            $this->config->int('database.port', 3306),
            $this->config->string('database.name', 'iced_out'),
        );

        $pdo = new PDO(
            $dsn,
            $this->config->string('database.user', 'root'),
            $this->config->string('database.password'),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ],
        );

        $pdo->exec("SET time_zone = '+00:00'");
        $pdo->exec("SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION'");

        return $this->pdo = $pdo;
    }

    /** Connects without selecting a database — used by `console.php migrate` to create it. */
    public function serverPdo(): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;charset=utf8mb4',
            $this->config->string('database.host', '127.0.0.1'),
            $this->config->int('database.port', 3306),
        );

        return new PDO(
            $dsn,
            $this->config->string('database.user', 'root'),
            $this->config->string('database.password'),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ],
        );
    }

    /**
     * @param list<mixed>|array<string, mixed> $bindings
     *
     * @return list<array<string, mixed>>
     */
    public function select(string $sql, array $bindings = []): array
    {
        $statement = $this->pdo()->prepare($sql);
        $statement->execute($bindings);

        /** @var list<array<string, mixed>> $rows */
        $rows = $statement->fetchAll();

        return $rows;
    }

    /**
     * @param list<mixed>|array<string, mixed> $bindings
     *
     * @return array<string, mixed>|null
     */
    public function selectOne(string $sql, array $bindings = []): ?array
    {
        $rows = $this->select($sql, $bindings);

        return $rows[0] ?? null;
    }

    /** @param list<mixed>|array<string, mixed> $bindings */
    public function statement(string $sql, array $bindings = []): int
    {
        $statement = $this->pdo()->prepare($sql);
        $statement->execute($bindings);

        return $statement->rowCount();
    }

    /** @param list<mixed>|array<string, mixed> $bindings */
    public function insert(string $sql, array $bindings = []): int
    {
        $this->statement($sql, $bindings);

        return (int) $this->pdo()->lastInsertId();
    }

    /**
     * Nested calls reuse the outer transaction via savepoints, so a service can
     * call another service without either knowing who opened the transaction.
     *
     * @template T
     *
     * @param callable(Database): T $work
     *
     * @return T
     */
    public function transaction(callable $work): mixed
    {
        $pdo = $this->pdo();

        if ($this->transactionDepth === 0) {
            $pdo->beginTransaction();
        } else {
            $pdo->exec('SAVEPOINT sp' . $this->transactionDepth);
        }

        ++$this->transactionDepth;

        try {
            $result = $work($this);
            --$this->transactionDepth;

            if ($this->transactionDepth === 0) {
                $pdo->commit();
            } else {
                $pdo->exec('RELEASE SAVEPOINT sp' . $this->transactionDepth);
            }

            return $result;
        } catch (Throwable $error) {
            --$this->transactionDepth;

            if ($this->transactionDepth === 0) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
            } else {
                $pdo->exec('ROLLBACK TO SAVEPOINT sp' . $this->transactionDepth);
            }

            throw $error;
        }
    }

    public function isHealthy(): bool
    {
        try {
            $this->pdo()->query('SELECT 1');

            return true;
        } catch (PDOException) {
            return false;
        }
    }

    /** 'mysql' or 'mariadb' — migrations pick their collation from this. */
    public function flavour(): string
    {
        $version = (string) $this->pdo()->getAttribute(PDO::ATTR_SERVER_VERSION);

        return stripos($version, 'mariadb') !== false ? 'mariadb' : 'mysql';
    }
}

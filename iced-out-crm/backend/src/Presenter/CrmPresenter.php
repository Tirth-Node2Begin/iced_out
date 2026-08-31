<?php

declare(strict_types=1);

namespace Iced\Presenter;

use DateTimeImmutable;
use DateTimeZone;
use Iced\Support\Clock;

/**
 * One presenter for the whole CRM layer.
 *
 * Six record types that share an owner, a set of timestamps and a money field
 * do not need six classes — they need one place where "who owns this" and "when
 * did this happen" are turned into strings the same way every time. Splitting
 * them would mean six copies of `owner()` drifting apart.
 *
 * Every payload is camelCase and pre-formatted, matching the console's existing
 * presenters: the browser renders what it is given and never reformats a date.
 */
final class CrmPresenter
{
    public function __construct(private readonly Clock $clock)
    {
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function lead(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'phone' => (string) $row['phone'],
            'company' => (string) $row['company_name'],
            'source' => (string) $row['source'],
            'status' => (string) $row['status'],
            'score' => (int) $row['score'],
            'message' => (string) ($row['message'] ?? ''),
            'owner' => $this->owner($row),
            'lostReason' => (string) $row['lost_reason'],
            'convertedContactId' => $this->nullableString($row['contact_public_id'] ?? null),
            'convertedDealId' => $this->nullableString($row['deal_public_id'] ?? null),
            'convertedAt' => $this->stamp($row['converted_at'] ?? null),
            'lastActivityAt' => $this->stamp($row['last_activity_at'] ?? null),
            'createdAt' => $this->stamp($row['created_at'] ?? null),
            'age' => $this->age($row['created_at'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function contact(array $row): array
    {
        $first = (string) $row['first_name'];
        $last = (string) $row['last_name'];

        return [
            'id' => (string) $row['public_id'],
            'firstName' => $first,
            'lastName' => $last,
            'name' => trim($first . ' ' . $last),
            'email' => (string) $row['email'],
            'phone' => (string) $row['phone'],
            'jobTitle' => (string) $row['job_title'],
            'lifecycle' => (string) $row['lifecycle'],
            'source' => (string) $row['source'],
            'city' => (string) $row['city'],
            'state' => (string) $row['state'],
            'country' => (string) $row['country'],
            'company' => $this->nullableString($row['company_public_id'] ?? null) === null ? null : [
                'id' => (string) $row['company_public_id'],
                'name' => (string) ($row['company_name'] ?? ''),
            ],
            /* The bridge to the storefront. Null means "known to us, has never
               had an account" — which is a fact worth showing, not a gap. */
            'customerId' => $this->nullableString($row['customer_public_id'] ?? null),
            'owner' => $this->owner($row),
            'ordersCount' => (int) ($row['orders_count'] ?? 0),
            'ordersTotal' => $this->money($row['orders_total'] ?? 0),
            'openDeals' => (int) ($row['open_deals'] ?? 0),
            'lastActivityAt' => $this->stamp($row['last_activity_at'] ?? null),
            'createdAt' => $this->stamp($row['created_at'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function company(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'domain' => (string) $row['domain'],
            'industry' => (string) $row['industry'],
            'sizeBand' => (string) $row['size_band'],
            'email' => (string) $row['email'],
            'phone' => (string) $row['phone'],
            'website' => (string) $row['website'],
            'city' => (string) $row['city'],
            'state' => (string) $row['state'],
            'country' => (string) $row['country'],
            'status' => (string) $row['status'],
            'owner' => $this->owner($row),
            'contactsCount' => (int) ($row['contacts_count'] ?? 0),
            'openDeals' => (int) ($row['open_deals'] ?? 0),
            'wonValue' => $this->money($row['won_value'] ?? 0),
            'createdAt' => $this->stamp($row['created_at'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function deal(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'title' => (string) $row['title'],
            'pipeline' => (string) ($row['pipeline_slug'] ?? ''),
            'stage' => [
                'id' => (string) ($row['stage_public_id'] ?? ''),
                'slug' => (string) ($row['stage_slug'] ?? ''),
                'name' => (string) ($row['stage_name'] ?? ''),
                'kind' => (string) ($row['stage_kind'] ?? 'OPEN'),
            ],
            'status' => (string) $row['status'],
            'amount' => $this->money($row['amount'] ?? 0),
            'amountRaw' => (float) ($row['amount'] ?? 0),
            'currency' => (string) $row['currency'],
            'probability' => (int) $row['probability'],
            'source' => (string) $row['source'],
            'contact' => $this->nullableString($row['contact_public_id'] ?? null) === null ? null : [
                'id' => (string) $row['contact_public_id'],
                'name' => trim((string) ($row['contact_name'] ?? '')),
            ],
            'company' => $this->nullableString($row['company_public_id'] ?? null) === null ? null : [
                'id' => (string) $row['company_public_id'],
                'name' => (string) ($row['company_name'] ?? ''),
            ],
            'orderNumber' => $this->nullableString($row['order_number'] ?? null),
            'owner' => $this->owner($row),
            'openTasks' => (int) ($row['open_tasks'] ?? 0),
            'expectedCloseOn' => $this->date($row['expected_close_on'] ?? null),
            'closedAt' => $this->stamp($row['closed_at'] ?? null),
            'lostReason' => (string) $row['lost_reason'],
            'lastActivityAt' => $this->stamp($row['last_activity_at'] ?? null),
            'createdAt' => $this->stamp($row['created_at'] ?? null),
            'position' => (int) ($row['position'] ?? 0),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function activity(array $row): array
    {
        $due = Format::parse($this->nullableString($row['due_at'] ?? null));
        $done = $this->nullableString($row['completed_at'] ?? null) !== null;

        return [
            'id' => (string) $row['public_id'],
            'type' => (string) $row['type'],
            'subject' => (string) $row['subject'],
            'body' => (string) ($row['body'] ?? ''),
            'about' => [
                'type' => (string) $row['subject_type'],
                'id' => (int) $row['subject_id'],
            ],
            'priority' => (string) $row['priority'],
            'dueAt' => $this->stamp($row['due_at'] ?? null),
            'dueDate' => $due === null ? null : Format::isoDate($due),
            'completedAt' => $this->stamp($row['completed_at'] ?? null),
            'done' => $done,
            /* Only an OPEN task can be overdue. A task finished after its due
               date is late history, not work waiting — and colouring it red on a
               list of things you have already done is just nagging. */
            'overdue' => !$done && $due !== null && $due < $this->clock->now(),
            'outcome' => (string) $row['outcome'],
            'owner' => $this->owner($row),
            'author' => (string) ($row['author_name'] ?? ''),
            'createdAt' => $this->stamp($row['created_at'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function note(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'body' => (string) $row['body'],
            'pinned' => (int) $row['pinned'] === 1,
            'author' => (string) ($row['author_name'] ?? ''),
            'createdAt' => $this->stamp($row['created_at'] ?? null),
            'updatedAt' => $this->stamp($row['updated_at'] ?? null),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function stage(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'slug' => (string) $row['slug'],
            'name' => (string) $row['name'],
            'kind' => (string) $row['kind'],
            'probability' => (int) $row['probability'],
            'position' => (int) $row['position'],
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function pipeline(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'slug' => (string) $row['slug'],
            'name' => (string) $row['name'],
            'isDefault' => (int) $row['is_default'] === 1,
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, mixed>>
     */
    public function map(array $rows, string $kind): array
    {
        return array_map(fn (array $row): array => $this->{$kind}($row), $rows);
    }

    /**
     * Who a record belongs to. Null rather than an empty shell when nobody owns
     * it — "unassigned" is a state the UI filters on, and an object with two
     * blank strings in it cannot be told apart from a broken join.
     *
     * @param array<string, mixed> $row
     *
     * @return array{id: string, name: string}|null
     */
    private function owner(array $row): ?array
    {
        $id = $this->nullableString($row['owner_public_id'] ?? null);

        if ($id === null) {
            return null;
        }

        return ['id' => $id, 'name' => (string) ($row['owner_name'] ?? '')];
    }

    /** "04 Aug 2026 · 09:18", or null when the column is unset. */
    private function stamp(mixed $stored): ?string
    {
        $moment = Format::parse($this->nullableString($stored));

        return $moment === null ? null : Format::sentAt($moment);
    }

    /** "2026-08-04" — for a DATE column the UI puts in a date input. */
    private function date(mixed $stored): ?string
    {
        $value = $this->nullableString($stored);

        if ($value === null) {
            return null;
        }

        $moment = DateTimeImmutable::createFromFormat('Y-m-d', substr($value, 0, 10), new DateTimeZone('UTC'));

        return $moment === false ? null : $moment->format('Y-m-d');
    }

    /** "₹4,28,420" — the same grouping the storefront and console already use. */
    private function money(mixed $amount): string
    {
        return '₹' . Format::groupIndian((int) round((float) $amount));
    }

    private function age(mixed $stored): string
    {
        $moment = Format::parse($this->nullableString($stored));

        return $moment === null ? '' : Format::age($moment, $this->clock->now());
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $string = (string) $value;

        return $string === '' ? null : $string;
    }
}

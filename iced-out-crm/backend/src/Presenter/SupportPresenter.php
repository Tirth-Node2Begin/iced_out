<?php

declare(strict_types=1);

namespace Iced\Presenter;

/** SupportQuery (spec §7.6). One record, read by both the shopper and the console. */
final class SupportPresenter
{
    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function row(array $row): array
    {
        return [
            'reference' => (string) $row['public_id'],
            'customer' => (string) $row['customer_name'],
            'email' => (string) $row['email'],
            'topic' => (string) $row['topic'],
            'order' => (string) $row['order_number'],
            'message' => (string) $row['message'],
            'sentAt' => (string) $row['sent_label'],
            'status' => (string) $row['status'],
            'reply' => (string) $row['reply'],
            /**
             * When the answer was written, or empty while there is none.
             *
             * `updated_at` rather than a column of its own: resolving is the
             * only thing that writes a reply, so the row's last touch IS the
             * moment it was answered. The shopper's inbox needs it — a support
             * reply with no date on it is the one message you cannot place.
             */
            'answeredAt' => $this->answeredAt($row),
        ];
    }

    /** @param array<string, mixed> $row */
    private function answeredAt(array $row): string
    {
        if ((string) $row['status'] !== 'Resolved') {
            return '';
        }

        $moment = Format::parse((string) ($row['updated_at'] ?? ''));

        return $moment === null ? '' : Format::sentAt($moment);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function rows(array $rows): array
    {
        return array_map(fn (array $row): array => $this->row($row), $rows);
    }
}

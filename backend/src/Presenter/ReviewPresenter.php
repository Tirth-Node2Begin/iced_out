<?php

declare(strict_types=1);

namespace Iced\Presenter;

/**
 * Review (spec §7.6). `rating` is a STRING — the console register renders flat
 * string maps and the storefront reads the same record, so one shape serves
 * both rather than two that agree until the first approval.
 */
final class ReviewPresenter
{
    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function row(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'product' => (string) $row['product_name'],
            /* The slug the review is filed against, which is what a product page
               matches on. The NAME above is what the console shows, and two
               products can carry the same one — matching a page's reviews by it
               would quote one piece's feedback on another. Empty where the
               product has since been deleted. */
            'productSlug' => (string) ($row['product_slug'] ?? ''),
            'rating' => (string) (int) $row['rating'],
            'customer' => (string) $row['customer_name'],
            'headline' => (string) $row['headline'],
            'body' => (string) ($row['body'] ?? ''),
            'fit' => (string) ($row['fit'] ?? ''),
            'submitted' => (string) $row['submitted_label'],
            'status' => (string) $row['status'],
            'origin' => (string) $row['origin'],
        ];
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

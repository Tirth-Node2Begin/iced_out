<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Kernel\Request;

/**
 * Spec §4.5. Catalog defaults to 24 per page, console to 50, hard cap 100.
 */
final class Paginator
{
    public function __construct(
        public readonly int $page,
        public readonly int $perPage,
    ) {
    }

    public static function fromRequest(Request $request, int $default = 50): self
    {
        $page = max(1, $request->queryInt('page', 1));
        $perPage = min(100, max(1, $request->queryInt('per_page', $default)));

        return new self($page, $perPage);
    }

    public function offset(): int
    {
        return ($this->page - 1) * $this->perPage;
    }

    /** @return array{page: int, per_page: int, total: int, total_pages: int} */
    public function meta(int $total): array
    {
        return [
            'page' => $this->page,
            'per_page' => $this->perPage,
            'total' => $total,
            'total_pages' => $total === 0 ? 0 : (int) ceil($total / $this->perPage),
        ];
    }
}

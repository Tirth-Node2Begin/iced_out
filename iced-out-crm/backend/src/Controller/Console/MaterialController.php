<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\MaterialPresenter;
use Iced\Repository\MaterialRepository;
use Iced\Repository\ProductionRepository;
use Iced\Service\Inventory\MaterialService;

/**
 * The raw-material half of inventory.
 *
 *   suppliers → purchases → (receipt) → materials
 *                                          ↓  product_materials (the recipe)
 *                                   production runs
 *                                          ↓
 *                                     stock_items
 *
 * Two state machines, and both are enforced here rather than in the browser:
 *
 *   PURCHASE   DRAFT → ORDERED → PARTIAL → RECEIVED, or CANCELLED
 *              Only ORDERED and PARTIAL may receive stock, which is what stops
 *              a draft quietly adding metres nobody has bought.
 *
 *   RUN        PLANNED → STARTED → DONE, or CANCELLED
 *              STARTED reserves what the recipe calls for, so a second run
 *              cannot promise the same fleece. DONE consumes the hold and adds
 *              the finished units. CANCELLED gives the hold back.
 *
 * Every quantity change goes through MaterialService, so `material_movements`
 * is always the complete story.
 */
final class MaterialController
{
    public function __construct(
        private readonly MaterialRepository $materials,
        private readonly ProductionRepository $production,
        private readonly MaterialService $stock,
        private readonly MaterialPresenter $presenter,
        private readonly Database $db,
    ) {
    }

    /* ============================================================ materials */

    /** GET /admin/inventory/materials */
    public function index(Request $request): Response
    {
        $rows = $this->materials->search([
            'kind' => $request->queryString('kind', 'all'),
            'supplier' => $request->queryString('supplier', 'all'),
            'status' => $request->queryString('status', 'all'),
            'risk' => $request->queryString('risk'),
            'q' => $request->queryString('q'),
        ]);

        $summary = $this->materials->summary();

        return Response::data([
            'materials' => $this->presenter->map($rows, 'material'),
            'summary' => [
                'total' => (int) ($summary['total'] ?? 0),
                'atRisk' => (int) ($summary['at_risk'] ?? 0),
                'outOfStock' => (int) ($summary['out_of_stock'] ?? 0),
                'stockValue' => '₹' . \Iced\Presenter\Format::groupIndian(
                    (int) round((float) ($summary['stock_value'] ?? 0)),
                ),
            ],
        ]);
    }

    /** GET /admin/inventory/materials/{material} */
    public function show(Request $request): Response
    {
        $material = $this->findMaterial($request->routeParam('material'));

        return Response::data([
            'material' => $this->presenter->material($material),
            'movements' => $this->presenter->map($this->materials->movements((int) $material['id']), 'movement'),
            'usedIn' => array_map(static fn (array $row): array => [
                'itemId' => (string) $row['item_public_id'],
                'item' => (string) $row['item_name'],
                'perUnit' => MaterialPresenter::qty($row['qty_per_unit']),
                'effective' => MaterialPresenter::qty(
                    MaterialPresenter::required((string) $row['qty_per_unit'], (string) $row['wastage_pct'], 1),
                ),
            ], $this->materials->usedIn((int) $material['id'])),
        ]);
    }

    /** POST /admin/inventory/materials */
    public function store(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $created = $this->materials->create([
            'code' => $this->str($input, 'code'),
            'name' => $this->str($input, 'name'),
            'kind' => strtoupper($this->str($input, 'kind', 'FABRIC')) ?: 'FABRIC',
            'unit' => strtoupper($this->str($input, 'unit', 'M')) ?: 'M',
            'reorderPoint' => $this->qty($input, 'reorderPoint'),
            'unitCost' => number_format((float) ($input['unitCost'] ?? 0), 2, '.', ''),
            'supplierId' => $this->supplierId($this->str($input, 'supplier')),
            'warehouseId' => $this->warehouseId($this->str($input, 'warehouse')),
            'notes' => $this->str($input, 'notes'),
        ]);

        $this->audit($request, 'material', $created['publicId']);

        return Response::data(['material' => $this->presenter->material($this->findMaterial($created['publicId']))], 201);
    }

    /** PATCH /admin/inventory/materials/{material} */
    public function update(Request $request): Response
    {
        $publicId = $request->routeParam('material');
        $material = $this->findMaterial($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $changes = ['updated_at' => $this->now()];

        foreach (['code' => 'code', 'name' => 'name', 'notes' => 'notes'] as $key => $column) {
            if ($this->has($input, $key)) {
                $changes[$column] = $this->str($input, $key);
            }
        }

        foreach (['kind', 'unit', 'status'] as $key) {
            if ($this->has($input, $key)) {
                $changes[$key] = strtoupper($this->str($input, $key));
            }
        }

        if ($this->has($input, 'reorderPoint')) {
            $changes['reorder_point'] = $this->qty($input, 'reorderPoint');
        }

        if ($this->has($input, 'unitCost')) {
            $changes['unit_cost'] = number_format((float) ($input['unitCost'] ?? 0), 2, '.', '');
        }

        if ($this->has($input, 'supplier')) {
            $changes['supplier_id'] = $this->supplierId($this->str($input, 'supplier'));
        }

        if ($this->has($input, 'warehouse')) {
            $changes['warehouse_id'] = $this->warehouseId($this->str($input, 'warehouse'));
        }

        /* `onHand` is deliberately NOT settable here. Changing a count is an
           adjustment with a reason behind it, and it goes through its own
           endpoint so the ledger gets a row saying why. */
        $this->materials->update((int) $material['id'], $changes);
        $this->audit($request, 'material', $publicId);

        return Response::data(['material' => $this->presenter->material($this->findMaterial($publicId))]);
    }

    /** DELETE /admin/inventory/materials/{material} */
    public function destroy(Request $request): Response
    {
        $publicId = $request->routeParam('material');
        $material = $this->findMaterial($publicId);

        if ((int) ($material['used_in'] ?? 0) > 0) {
            throw new ConflictException('ICE-INV-409', sprintf(
                '%s is still on %d recipe%s. Take it off those first, or archive it instead.',
                (string) $material['name'],
                (int) $material['used_in'],
                (int) $material['used_in'] === 1 ? '' : 's',
            ));
        }

        $this->materials->softDelete((int) $material['id']);
        $this->audit($request, 'material', $publicId);

        return Response::noContent();
    }

    /**
     * POST /admin/inventory/materials/{material}/adjust
     *
     * A stocktake correction. The reason is required by the route's rules, not
     * optional — an adjustment nobody can explain later is the one ledger entry
     * that makes the whole ledger untrustworthy.
     */
    public function adjust(Request $request): Response
    {
        $publicId = $request->routeParam('material');
        $material = $this->findMaterial($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        return $this->db->transaction(function () use ($material, $publicId, $input, $request): Response {
            $this->stock->adjust(
                (int) $material['id'],
                $this->qty($input, 'onHand'),
                $this->str($input, 'reason'),
                $this->actorId($request),
            );

            $this->audit($request, 'material', $publicId);

            return Response::data(['material' => $this->presenter->material($this->findMaterial($publicId))]);
        });
    }

    /** POST /admin/inventory/materials/{material}/write-off */
    public function writeOff(Request $request): Response
    {
        $publicId = $request->routeParam('material');
        $material = $this->findMaterial($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        return $this->db->transaction(function () use ($material, $publicId, $input, $request): Response {
            $this->stock->writeOff(
                (int) $material['id'],
                $this->qty($input, 'qty'),
                strtoupper($this->str($input, 'type', 'WASTAGE')),
                $this->str($input, 'reason'),
                $this->actorId($request),
            );

            $this->audit($request, 'material', $publicId);

            return Response::data(['material' => $this->presenter->material($this->findMaterial($publicId))]);
        });
    }

    /* ============================================================ suppliers */

    /** GET /admin/inventory/suppliers */
    public function suppliers(Request $request): Response
    {
        return Response::data([
            'suppliers' => $this->presenter->map(
                $this->materials->suppliers([
                    'status' => $request->queryString('status', 'all'),
                    'q' => $request->queryString('q'),
                ]),
                'supplier',
            ),
        ]);
    }

    /** POST /admin/inventory/suppliers */
    public function storeSupplier(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();
        $name = $this->str($input, 'name');

        if ($this->materials->findSupplierByName($name) !== null) {
            throw new ConflictException('ICE-INV-409', 'A supplier with that name already exists.');
        }

        $created = $this->materials->createSupplier([
            'name' => $name,
            'contactName' => $this->str($input, 'contactName'),
            'email' => $this->str($input, 'email'),
            'phone' => $this->str($input, 'phone'),
            'city' => $this->str($input, 'city'),
            'country' => $this->str($input, 'country', 'India') ?: 'India',
            'leadTimeDays' => max(0, (int) ($input['leadTimeDays'] ?? 0)),
            'notes' => $this->str($input, 'notes'),
        ]);

        $this->audit($request, 'supplier', $created['publicId']);

        return Response::data(
            ['supplier' => $this->presenter->supplier($this->findSupplier($created['publicId']))],
            201,
        );
    }

    /** PATCH /admin/inventory/suppliers/{supplier} */
    public function updateSupplier(Request $request): Response
    {
        $publicId = $request->routeParam('supplier');
        $supplier = $this->findSupplier($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $changes = ['updated_at' => $this->now()];

        $simple = [
            'contactName' => 'contact_name',
            'email' => 'email',
            'phone' => 'phone',
            'city' => 'city',
            'country' => 'country',
            'notes' => 'notes',
        ];

        foreach ($simple as $key => $column) {
            if ($this->has($input, $key)) {
                $changes[$column] = $this->str($input, $key);
            }
        }

        if ($this->has($input, 'name')) {
            $name = $this->str($input, 'name');
            $duplicate = $this->materials->findSupplierByName($name);

            if ($duplicate !== null && (int) $duplicate['id'] !== (int) $supplier['id']) {
                throw new ConflictException('ICE-INV-409', 'Another supplier already uses that name.');
            }

            $changes['name'] = $name;
            $changes['name_normalized'] = mb_strtolower($name);
        }

        if ($this->has($input, 'leadTimeDays')) {
            $changes['lead_time_days'] = max(0, (int) ($input['leadTimeDays'] ?? 0));
        }

        if ($this->has($input, 'status')) {
            $changes['status'] = strtoupper($this->str($input, 'status'));
        }

        $this->materials->updateSupplier((int) $supplier['id'], $changes);
        $this->audit($request, 'supplier', $publicId);

        return Response::data(['supplier' => $this->presenter->supplier($this->findSupplier($publicId))]);
    }

    /** DELETE /admin/inventory/suppliers/{supplier} */
    public function destroySupplier(Request $request): Response
    {
        $publicId = $request->routeParam('supplier');
        $supplier = $this->findSupplier($publicId);

        $this->materials->softDeleteSupplier((int) $supplier['id']);
        $this->audit($request, 'supplier', $publicId);

        return Response::noContent();
    }

    /* ============================================================ purchases */

    /** GET /admin/inventory/purchases */
    public function purchases(Request $request): Response
    {
        return Response::data([
            'purchases' => $this->presenter->map(
                $this->production->purchases([
                    'status' => $request->queryString('status', 'all'),
                    'supplier' => $request->queryString('supplier', 'all'),
                    'q' => $request->queryString('q'),
                ]),
                'purchase',
            ),
        ]);
    }

    /** GET /admin/inventory/purchases/{purchase} */
    public function showPurchase(Request $request): Response
    {
        $purchase = $this->findPurchase($request->routeParam('purchase'));

        return Response::data([
            'purchase' => $this->presenter->purchase($purchase),
            'lines' => $this->presenter->map($this->production->purchaseLines((int) $purchase['id']), 'purchaseLine'),
        ]);
    }

    /** POST /admin/inventory/purchases */
    public function storePurchase(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $supplier = $this->materials->findSupplier($this->str($input, 'supplier'));

        if ($supplier === null) {
            throw new NotFoundException('ICE-INV-404', 'That supplier could not be found.');
        }

        $created = $this->production->createPurchase(
            (int) $supplier['id'],
            $this->str($input, 'expectedOn') ?: null,
            $this->str($input, 'notes'),
            $this->actorId($request),
        );

        $this->audit($request, 'material_purchase', $created['publicId']);

        return Response::data(['purchase' => $this->presenter->purchase($this->findPurchase($created['publicId']))], 201);
    }

    /**
     * PUT /admin/inventory/purchases/{purchase}/lines
     *
     * The whole line set at once, because a purchase order is edited as a
     * document rather than a row at a time — and sending it whole is what makes
     * removing a line possible without a second endpoint.
     */
    public function setPurchaseLines(Request $request): Response
    {
        $publicId = $request->routeParam('purchase');
        $purchase = $this->findPurchase($publicId);
        /** @var array{lines?: list<array<string, mixed>>} $input */
        $input = $request->validated();

        if (!in_array((string) $purchase['status'], ['DRAFT', 'ORDERED'], true)) {
            throw new ConflictException('ICE-INV-409', 'A purchase that has started arriving can no longer be re-drafted.');
        }

        $lines = is_array($input['lines'] ?? null) ? $input['lines'] : [];

        return $this->db->transaction(function () use ($purchase, $publicId, $lines, $request): Response {
            $keep = [];

            foreach ($lines as $line) {
                if (!is_array($line)) {
                    continue;
                }

                $material = $this->materials->find((string) ($line['material'] ?? ''));

                if ($material === null) {
                    throw new NotFoundException('ICE-INV-404', 'One of those materials could not be found.');
                }

                $this->production->setPurchaseLine(
                    (int) $purchase['id'],
                    (int) $material['id'],
                    number_format(max(0, (float) ($line['qty'] ?? 0)), 3, '.', ''),
                    number_format(max(0, (float) ($line['unitCost'] ?? $material['unit_cost'])), 2, '.', ''),
                );

                $keep[] = (int) $material['id'];
            }

            /* Anything not in the payload has been taken off the order. Done
               after the upserts so a line that was only moved is never dropped. */
            foreach ($this->production->purchaseLines((int) $purchase['id']) as $existing) {
                if (!in_array((int) $existing['material_id'], $keep, true)) {
                    $this->production->removePurchaseLine((int) $purchase['id'], (int) $existing['material_id']);
                }
            }

            $this->audit($request, 'material_purchase', $publicId);

            return Response::data([
                'purchase' => $this->presenter->purchase($this->findPurchase($publicId)),
                'lines' => $this->presenter->map($this->production->purchaseLines((int) $purchase['id']), 'purchaseLine'),
            ]);
        });
    }

    /**
     * POST /admin/inventory/purchases/{purchase}/transition
     *
     * `order` sends it; `cancel` abandons it. Receiving has its own endpoint,
     * because it carries quantities and these do not.
     */
    public function transitionPurchase(Request $request): Response
    {
        $publicId = $request->routeParam('purchase');
        $purchase = $this->findPurchase($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $to = strtolower($this->str($input, 'to'));
        $status = (string) $purchase['status'];

        if ($to === 'order') {
            if ($status !== 'DRAFT') {
                throw new ConflictException('ICE-INV-409', 'Only a draft can be sent to the supplier.');
            }

            if ($this->production->purchaseLines((int) $purchase['id']) === []) {
                throw new ConflictException('ICE-INV-409', 'Add at least one material before ordering.');
            }

            $this->production->updatePurchase((int) $purchase['id'], [
                'status' => 'ORDERED',
                'ordered_on' => date('Y-m-d'),
                'updated_at' => $this->now(),
            ]);
        } elseif ($to === 'cancel') {
            if (in_array($status, ['RECEIVED', 'CANCELLED'], true)) {
                throw new ConflictException('ICE-INV-409', 'That purchase is already closed.');
            }

            /* Whatever already arrived STAYS received — the material is on the
               shelf and the ledger says so. Cancelling only stops the rest. */
            $this->production->updatePurchase((int) $purchase['id'], [
                'status' => 'CANCELLED',
                'updated_at' => $this->now(),
            ]);
        } else {
            throw new ConflictException('ICE-INV-409', 'That is not something a purchase can do.');
        }

        $this->audit($request, 'material_purchase', $publicId);

        return Response::data(['purchase' => $this->presenter->purchase($this->findPurchase($publicId))]);
    }

    /**
     * POST /admin/inventory/purchases/{purchase}/receive
     *
     * A delivery arriving. Quantities are per line and may be partial — the
     * purchase settles at RECEIVED only once every line is fully in, and sits at
     * PARTIAL until then, which is the honest state for an order still owed
     * forty metres.
     */
    public function receivePurchase(Request $request): Response
    {
        $publicId = $request->routeParam('purchase');
        $purchase = $this->findPurchase($publicId);
        /** @var array{lines?: list<array<string, mixed>>} $input */
        $input = $request->validated();

        if (!in_array((string) $purchase['status'], ['ORDERED', 'PARTIAL'], true)) {
            throw new ConflictException(
                'ICE-INV-409',
                'Only a purchase that has been ordered can receive stock.',
            );
        }

        $lines = is_array($input['lines'] ?? null) ? $input['lines'] : [];

        if ($lines === []) {
            throw new ConflictException('ICE-INV-409', 'Say how much of what arrived.');
        }

        return $this->db->transaction(function () use ($purchase, $publicId, $lines, $request): Response {
            $actorId = $this->actorId($request);

            foreach ($lines as $line) {
                if (!is_array($line)) {
                    continue;
                }

                $qty = max(0, (float) ($line['qty'] ?? 0));

                if ($qty <= 0) {
                    continue;
                }

                $material = $this->materials->find((string) ($line['material'] ?? ''));

                if ($material === null) {
                    throw new NotFoundException('ICE-INV-404', 'One of those materials could not be found.');
                }

                $formatted = number_format($qty, 3, '.', '');

                $this->stock->receive(
                    (int) $material['id'],
                    $formatted,
                    'purchase',
                    (string) $purchase['public_id'],
                    isset($line['unitCost']) ? number_format((float) $line['unitCost'], 2, '.', '') : null,
                    $actorId,
                );

                $this->production->addReceived((int) $purchase['id'], (int) $material['id'], $formatted);
            }

            /* Fully in only when EVERY line is. A short delivery leaves the
               purchase open, which is what an operator needs to see. */
            $outstanding = 0;

            foreach ($this->production->purchaseLines((int) $purchase['id']) as $existing) {
                if ((float) $existing['qty_received'] < (float) $existing['qty_ordered']) {
                    ++$outstanding;
                }
            }

            $this->production->updatePurchase((int) $purchase['id'], [
                'status' => $outstanding === 0 ? 'RECEIVED' : 'PARTIAL',
                'received_on' => $outstanding === 0 ? date('Y-m-d') : null,
                'updated_at' => $this->now(),
            ]);

            $this->audit($request, 'material_purchase', $publicId);

            return Response::data([
                'purchase' => $this->presenter->purchase($this->findPurchase($publicId)),
                'lines' => $this->presenter->map($this->production->purchaseLines((int) $purchase['id']), 'purchaseLine'),
            ]);
        });
    }

    /** DELETE /admin/inventory/purchases/{purchase} */
    public function destroyPurchase(Request $request): Response
    {
        $publicId = $request->routeParam('purchase');
        $purchase = $this->findPurchase($publicId);

        if (!in_array((string) $purchase['status'], ['DRAFT', 'CANCELLED'], true)) {
            throw new ConflictException(
                'ICE-INV-409',
                'A purchase that has been ordered is part of the record. Cancel it instead.',
            );
        }

        $this->production->softDeletePurchase((int) $purchase['id']);
        $this->audit($request, 'material_purchase', $publicId);

        return Response::noContent();
    }

    /* ============================================================== recipes */

    /** GET /admin/inventory/recipes/{item} — what a stock item is made of. */
    public function recipe(Request $request): Response
    {
        $item = $this->findStockItem($request->routeParam('item'));
        $lines = $this->materials->recipe((int) $item['id']);

        $unitCost = 0.0;

        foreach ($lines as $line) {
            $unitCost += (float) MaterialPresenter::required(
                (string) $line['qty_per_unit'],
                (string) $line['wastage_pct'],
                1,
            ) * (float) $line['unit_cost'];
        }

        return Response::data([
            'item' => ['id' => (string) $item['public_id'], 'name' => (string) $item['item_name']],
            'lines' => $this->presenter->map($lines, 'recipeLine'),
            /* What one finished piece costs in materials — the number that says
               whether the retail price makes sense. */
            'materialCost' => '₹' . \Iced\Presenter\Format::groupIndian((int) round($unitCost)),
        ]);
    }

    /** PUT /admin/inventory/recipes/{item} — the whole recipe at once. */
    public function setRecipe(Request $request): Response
    {
        $item = $this->findStockItem($request->routeParam('item'));
        /** @var array{lines?: list<array<string, mixed>>} $input */
        $input = $request->validated();
        $lines = is_array($input['lines'] ?? null) ? $input['lines'] : [];

        return $this->db->transaction(function () use ($item, $lines, $request): Response {
            $keep = [];

            foreach ($lines as $line) {
                if (!is_array($line)) {
                    continue;
                }

                $material = $this->materials->find((string) ($line['material'] ?? ''));

                if ($material === null) {
                    throw new NotFoundException('ICE-INV-404', 'One of those materials could not be found.');
                }

                $this->materials->setRecipeLine(
                    (int) $item['id'],
                    (int) $material['id'],
                    number_format(max(0, (float) ($line['perUnit'] ?? 0)), 4, '.', ''),
                    number_format(max(0, min(100, (float) ($line['wastagePct'] ?? 0))), 2, '.', ''),
                    mb_substr((string) ($line['note'] ?? ''), 0, 190),
                );

                $keep[] = (int) $material['id'];
            }

            foreach ($this->materials->recipe((int) $item['id']) as $existing) {
                if (!in_array((int) $existing['material_id'], $keep, true)) {
                    $this->materials->removeRecipeLine((int) $item['id'], (int) $existing['material_id']);
                }
            }

            $this->audit($request, 'stock_item', (string) $item['public_id']);

            return $this->recipe($request);
        });
    }

    /* ================================================================= runs */

    /** GET /admin/inventory/runs */
    public function runs(Request $request): Response
    {
        $rows = $this->production->runs([
            'status' => $request->queryString('status', 'all'),
            'item' => $request->queryString('item', 'all'),
            'q' => $request->queryString('q'),
        ]);

        $summary = $this->production->runSummary();

        return Response::data([
            'runs' => $this->presenter->map($rows, 'run'),
            'summary' => [
                'total' => (int) ($summary['total'] ?? 0),
                'planned' => (int) ($summary['planned'] ?? 0),
                'started' => (int) ($summary['started'] ?? 0),
                'unitsMade' => (int) ($summary['units_made'] ?? 0),
            ],
        ]);
    }

    /** GET /admin/inventory/runs/{run} */
    public function showRun(Request $request): Response
    {
        $run = $this->findRun($request->routeParam('run'));

        return Response::data($this->runPayload($run));
    }

    /**
     * POST /admin/inventory/runs
     *
     * Creating a run FREEZES the recipe onto it. The recipe can change next
     * month; a run that happened in August has to keep saying what it used in
     * August — the same reason `order_items` freezes its prices.
     */
    public function storeRun(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $item = $this->findStockItem($this->str($input, 'item'));
        $recipe = $this->materials->recipe((int) $item['id']);

        if ($recipe === []) {
            throw new ConflictException('ICE-INV-409', sprintf(
                '%s has no recipe yet. Say what it is made of before planning a run.',
                (string) $item['item_name'],
            ));
        }

        $qty = max(1, (int) ($input['qty'] ?? 0));

        return $this->db->transaction(function () use ($item, $recipe, $qty, $input, $request): Response {
            $created = $this->production->createRun(
                (int) $item['id'],
                $this->warehouseId($this->str($input, 'warehouse')) ?? (int) $item['warehouse_id'],
                $qty,
                $this->str($input, 'notes'),
                $this->actorId($request),
            );

            foreach ($recipe as $line) {
                $this->production->snapshotRecipe(
                    $created['id'],
                    (int) $line['material_id'],
                    (string) $line['qty_per_unit'],
                    (string) $line['wastage_pct'],
                );
            }

            $this->audit($request, 'production_run', $created['publicId']);

            return Response::data($this->runPayload($this->findRun($created['publicId'])), 201);
        });
    }

    /**
     * POST /admin/inventory/runs/{run}/transition
     *
     * `start` holds the materials · `complete` consumes them and adds the
     * finished units · `cancel` gives the hold back.
     */
    public function transitionRun(Request $request): Response
    {
        $publicId = $request->routeParam('run');
        $run = $this->findRun($publicId);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $to = strtolower($this->str($input, 'to'));

        return $this->db->transaction(function () use ($run, $publicId, $to, $input, $request): Response {
            $actorId = $this->actorId($request);
            $status = (string) $run['status'];
            $runId = (int) $run['id'];

            if ($to === 'start') {
                if ($status !== 'PLANNED') {
                    throw new ConflictException('ICE-INV-409', 'Only a planned run can be started.');
                }

                /* Reserve everything the frozen recipe calls for. Any line
                   short throws, and the transaction rolls the rest back — a run
                   half-holding its materials is worse than one that never
                   started, because the held half is invisible to everyone else. */
                foreach ($this->production->runLines($runId) as $line) {
                    $needed = MaterialPresenter::required(
                        (string) $line['qty_per_unit'],
                        (string) $line['wastage_pct'],
                        (int) $run['qty_planned'],
                    );

                    $this->stock->reserve((int) $line['material_id'], $needed, 'production', $publicId, $actorId);
                    $this->production->setRunLineQty($runId, (int) $line['material_id'], 'qty_reserved', $needed);
                }

                $this->production->updateRun($runId, [
                    'status' => 'STARTED',
                    'started_at' => $this->now(),
                    'updated_at' => $this->now(),
                ]);
            } elseif ($to === 'complete') {
                if ($status !== 'STARTED') {
                    throw new ConflictException('ICE-INV-409', 'Only a run that has started can be completed.');
                }

                /* What was actually made, which is not always what was planned:
                   a run of 40 that yields 38 has two rejects, and recording 40
                   would put units in the warehouse nobody can pick. */
                $produced = isset($input['produced'])
                    ? max(0, (int) $input['produced'])
                    : (int) $run['qty_planned'];

                if ($produced > (int) $run['qty_planned']) {
                    throw new ConflictException('ICE-INV-409', sprintf(
                        'This run only holds material for %d. Plan a bigger run rather than over-producing this one.',
                        (int) $run['qty_planned'],
                    ));
                }

                foreach ($this->production->runLines($runId) as $line) {
                    $held = (string) $line['qty_reserved'];
                    $used = MaterialPresenter::required(
                        (string) $line['qty_per_unit'],
                        (string) $line['wastage_pct'],
                        $produced,
                    );

                    $materialId = (int) $line['material_id'];

                    $this->stock->consumeReserved($materialId, $used, 'production', $publicId, $actorId);
                    $this->production->setRunLineQty($runId, $materialId, 'qty_consumed', $used);

                    /* Whatever the shortfall held but did not use goes back on
                       the shelf, or it stays invisibly reserved for ever. */
                    $spare = MaterialService::toMilli($held) - MaterialService::toMilli($used);

                    if ($spare > 0) {
                        $this->stock->release(
                            $materialId,
                            MaterialService::fromMilli($spare),
                            'production',
                            $publicId,
                            $actorId,
                        );
                        $this->production->setRunLineQty($runId, $materialId, 'qty_reserved', $used);
                    }
                }

                /* And the point of the whole exercise: finished pieces. */
                if ($produced > 0) {
                    $this->db->statement(
                        'UPDATE stock_items SET total_units = total_units + ?, version = version + 1 WHERE id = ?',
                        [$produced, (int) $run['stock_item_id']],
                    );

                    $this->db->insert(
                        'INSERT INTO inventory_movements
                            (stock_item_id, type, qty, reference_type, reference_id, actor_id, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            (int) $run['stock_item_id'],
                            'PURCHASE_IN',
                            $produced,
                            'production',
                            $publicId,
                            $actorId,
                            $this->now(),
                        ],
                    );
                }

                $this->production->updateRun($runId, [
                    'status' => 'DONE',
                    'qty_produced' => $produced,
                    'completed_at' => $this->now(),
                    'updated_at' => $this->now(),
                ]);
            } elseif ($to === 'cancel') {
                if (in_array($status, ['DONE', 'CANCELLED'], true)) {
                    throw new ConflictException('ICE-INV-409', 'That run is already closed.');
                }

                if ($status === 'STARTED') {
                    foreach ($this->production->runLines($runId) as $line) {
                        $this->stock->release(
                            (int) $line['material_id'],
                            (string) $line['qty_reserved'],
                            'production',
                            $publicId,
                            $actorId,
                        );
                        $this->production->setRunLineQty($runId, (int) $line['material_id'], 'qty_reserved', '0.000');
                    }
                }

                $this->production->updateRun($runId, ['status' => 'CANCELLED', 'updated_at' => $this->now()]);
            } else {
                throw new ConflictException('ICE-INV-409', 'That is not something a run can do.');
            }

            $this->audit($request, 'production_run', $publicId);

            return Response::data($this->runPayload($this->findRun($publicId)));
        });
    }

    /** DELETE /admin/inventory/runs/{run} */
    public function destroyRun(Request $request): Response
    {
        $publicId = $request->routeParam('run');
        $run = $this->findRun($publicId);

        if (!in_array((string) $run['status'], ['PLANNED', 'CANCELLED'], true)) {
            throw new ConflictException(
                'ICE-INV-409',
                'A run that has started is part of the record. Cancel it instead.',
            );
        }

        $this->production->softDeleteRun((int) $run['id']);
        $this->audit($request, 'production_run', $publicId);

        return Response::noContent();
    }

    /* ============================================================== helpers */

    /**
     * @param array<string, mixed> $run
     *
     * @return array<string, mixed>
     */
    private function runPayload(array $run): array
    {
        /* Lines are costed against what the run will PRODUCE once it is done,
           and against what it planned before that — so a completed run reads as
           what it actually took. */
        $units = (string) $run['status'] === 'DONE'
            ? (int) $run['qty_produced']
            : (int) $run['qty_planned'];

        $lines = array_map(
            fn (array $line): array => $this->presenter->runLine($line, $units),
            $this->production->runLines((int) $run['id']),
        );

        return [
            'run' => $this->presenter->run($run),
            'lines' => $lines,
            /* Whether START would succeed right now, answered once here rather
               than re-derived by the button. */
            'canStart' => (string) $run['status'] === 'PLANNED'
                && $lines !== []
                && !array_filter($lines, static fn (array $l): bool => $l['short'] === true),
        ];
    }

    /** @return array<string, mixed> */
    private function findMaterial(string $publicId): array
    {
        $row = $this->materials->find($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-INV-404', 'That material could not be found.');
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function findSupplier(string $publicId): array
    {
        $row = $this->materials->findSupplier($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-INV-404', 'That supplier could not be found.');
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function findPurchase(string $publicId): array
    {
        $row = $this->production->findPurchase($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-INV-404', 'That purchase could not be found.');
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function findRun(string $publicId): array
    {
        $row = $this->production->findRun($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-INV-404', 'That production run could not be found.');
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function findStockItem(string $publicId): array
    {
        $row = $this->db->selectOne(
            'SELECT * FROM stock_items WHERE public_id = ? AND deleted_at IS NULL LIMIT 1',
            [$publicId],
        );

        if ($row === null) {
            throw new NotFoundException('ICE-INV-404', 'That stock item could not be found.');
        }

        return $row;
    }

    private function supplierId(string $publicId): ?int
    {
        if ($publicId === '' || $publicId === 'none') {
            return null;
        }

        $row = $this->materials->findSupplier($publicId);

        if ($row === null) {
            throw new NotFoundException('ICE-INV-404', 'That supplier could not be found.');
        }

        return (int) $row['id'];
    }

    private function warehouseId(string $publicId): ?int
    {
        if ($publicId === '' || $publicId === 'none') {
            return null;
        }

        $row = $this->db->selectOne('SELECT id FROM warehouses WHERE public_id = ? LIMIT 1', [$publicId]);

        if ($row === null) {
            throw new NotFoundException('ICE-INV-404', 'That warehouse could not be found.');
        }

        return (int) $row['id'];
    }

    private function actorId(Request $request): ?int
    {
        $principal = $request->attribute('principal');

        return $principal instanceof Principal ? $principal->userId : null;
    }

    private function audit(Request $request, string $type, string $id): void
    {
        $request->setAttribute('audit_entity_type', $type);
        $request->setAttribute('audit_entity_id', $id);
    }

    private function now(): string
    {
        return gmdate('Y-m-d H:i:s') . '.000000';
    }

    /** @param array<string, mixed> $input */
    private function has(array $input, string $key): bool
    {
        return array_key_exists($key, $input);
    }

    /** @param array<string, mixed> $input */
    private function str(array $input, string $key, string $default = ''): string
    {
        $value = $input[$key] ?? null;

        return is_scalar($value) ? trim((string) $value) : $default;
    }

    /** @param array<string, mixed> $input */
    private function qty(array $input, string $key): string
    {
        return number_format(max(0, (float) ($input[$key] ?? 0)), 3, '.', '');
    }
}

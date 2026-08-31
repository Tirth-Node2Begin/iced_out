<?php

declare(strict_types=1);

namespace Iced\Tests\Contract;

use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Response;
use Iced\Support\Json;
use PHPUnit\Framework\TestCase;

/**
 * Spec §4.3 is non-negotiable: these shapes are what src/api/types.ts and
 * src/api/error-normalizer.ts already implement in the frontend. If a key here
 * changes, the UI breaks silently.
 */
final class EnvelopeTest extends TestCase
{
    public function testSuccessEnvelopeWrapsPayloadUnderData(): void
    {
        $response = Response::data(['ok' => true])->withMeta('request_id', 'req-1');

        self::assertSame(
            ['data' => ['ok' => true], 'meta' => ['request_id' => 'req-1']],
            Json::decodeArray($response->body()),
        );
    }

    public function testPaginationRidesInMetaWithSnakeCaseKeys(): void
    {
        $response = Response::paginated([1, 2], [
            'page' => 1,
            'per_page' => 24,
            'total' => 96,
            'total_pages' => 4,
        ]);

        $body = Json::decodeArray($response->body());

        self::assertIsArray($body);
        self::assertSame(['page' => 1, 'per_page' => 24, 'total' => 96, 'total_pages' => 4], $body['meta']['pagination']);
    }

    public function testValidationFailureCarriesFieldErrors(): void
    {
        $error = ValidationException::field('quantity', 'Only 2 left in this size.', 'ICE-CART-422');

        self::assertSame(422, $error->status());
        self::assertSame([
            'error' => [
                'code' => 'ICE-CART-422',
                'message' => 'Only 2 left in this size.',
                'retryable' => false,
                'errors' => [['field' => 'quantity', 'detail' => 'Only 2 left in this size.']],
            ],
        ], $error->toEnvelope());
    }

    public function testConflictEnvelopeOmitsErrorsWhenThereAreNone(): void
    {
        $error = new ConflictException('ICE-ORD-409', 'That order is already confirmed.');

        self::assertSame(409, $error->status());
        self::assertArrayNotHasKey('errors', $error->toEnvelope()['error']);
    }

    public function testNoContentResponsesHaveNoBody(): void
    {
        self::assertSame(204, Response::noContent()->status());
        self::assertSame('', Response::noContent()->body());
    }

    public function testMoneyStringsSurviveJsonEncodingUnescaped(): void
    {
        // The rupee sign must reach the UI as UTF-8, not as ₹.
        $response = Response::data(['total' => '₹17,800']);

        self::assertStringContainsString('₹17,800', $response->body());
    }
}

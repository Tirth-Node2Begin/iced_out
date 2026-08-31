<?php

declare(strict_types=1);

namespace Iced\Integration\BackgroundRemoval;

use CURLStringFile;
use Iced\Support\Json;
use Iced\Support\Logger;

/**
 * remove.bg — https://www.remove.bg/api
 *
 * One POST, multipart, `X-Api-Key` in the header. A success is the cut-out
 * image ITSELF in the body, not JSON with a URL in it, which is why the reply
 * is read as bytes and only parsed as JSON when the status says it failed.
 *
 * `type=product` is the hint that matters here. remove.bg segments differently
 * depending on what it thinks it is looking at, and a garment on a ghost
 * mannequin is a product shot, not a person — left on `auto` it periodically
 * decides the empty sleeves are a human and keeps a halo of backdrop where the
 * body would be.
 *
 * The key is read from the environment and never logged, never returned in a
 * response, and never written into `store_settings` — settings are operator
 * data and spec §14 forbids secrets there.
 */
final class RemoveBgClient implements BackgroundRemover
{
    /** remove.bg's own documented failures, in language an operator can act on. */
    private const MESSAGES = [
        400 => 'remove.bg could not find a garment in that photograph. Try a shot with the piece clear of the background.',
        402 => 'The remove.bg account is out of credits. Top it up and press Retry.',
        403 => 'remove.bg rejected the API key. Check REMOVE_BG_API_KEY in backend/.env.',
        429 => 'remove.bg is rate-limiting this account. Wait a moment and press Retry.',
    ];

    public function __construct(
        private readonly string $apiKey,
        private readonly string $endpoint,
        /** `auto` bills by output size; `preview` is the free-tier 0.25MP. */
        private readonly string $size,
        private readonly int $timeout,
        private readonly Logger $logger,
    ) {
    }

    public function isConfigured(): bool
    {
        return $this->apiKey !== '';
    }

    public function name(): string
    {
        return 'remove.bg';
    }

    public function cutout(string $bytes, string $filename): string
    {
        if ($bytes === '') {
            throw new BackgroundRemovalFailed('There was nothing to cut out — the stored photograph was empty.');
        }

        $handle = curl_init($this->endpoint);

        if ($handle === false) {
            throw new BackgroundRemovalFailed('Could not open a connection to remove.bg.', true);
        }

        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => $this->timeout,
            // The reply is an image; following a redirect to somewhere else and
            // storing whatever came back is not a thing that should be possible.
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => ['X-Api-Key: ' . $this->apiKey, 'Accept: image/*, application/json'],
            CURLOPT_POSTFIELDS => [
                'image_file' => new CURLStringFile($bytes, $filename, 'application/octet-stream'),
                'size' => $this->size,
                'type' => 'product',
                // PNG, because the whole point is the alpha channel. `auto`
                // answers JPEG when it judges the result opaque, and a hero
                // garment on a white rectangle is exactly the bug this feature
                // exists to remove.
                'format' => 'png',
            ],
        ]);

        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $transportError = curl_error($handle);
        curl_close($handle);

        if (!is_string($body) || $body === '') {
            $this->logger->warning('remove.bg call failed at the transport', ['detail' => $transportError]);

            throw new BackgroundRemovalFailed(
                'remove.bg could not be reached. Check the server\'s internet access and press Retry.',
                true,
            );
        }

        if ($status === 200) {
            return $body;
        }

        $this->logger->warning('remove.bg refused a cutout', [
            'status' => $status,
            /* The body of a failure is JSON, and remove.bg does not echo the
               key back — so this is safe to keep and is the only way to tell
               "no credits" from "bad key" after the fact. */
            'body' => substr($body, 0, 400),
        ]);

        throw new BackgroundRemovalFailed(
            self::MESSAGES[$status] ?? $this->describe($status, $body),
            $status >= 500 || $status === 429,
        );
    }

    /** A status remove.bg has not documented — quote what it actually said. */
    private function describe(int $status, string $body): string
    {
        $decoded = Json::decodeArray($body);
        $first = is_array($decoded['errors'][0] ?? null) ? $decoded['errors'][0] : [];
        $title = is_string($first['title'] ?? null) ? $first['title'] : '';

        return $title === ''
            ? sprintf('remove.bg answered %d. Press Retry, or check the account at remove.bg.', $status)
            : sprintf('remove.bg said: %s', $title);
    }
}

<?php

declare(strict_types=1);

namespace Iced\Integration\Tracking;

use Iced\Support\Json;
use Iced\Support\Logger;

/**
 * iThink Logistics — https://docs.ithinklogistics.com/doc-track-order/3
 *
 * One call: POST {base}/order/track.json, credentials in the BODY rather than a
 * header, which is unusual and is why they are passed here and never logged.
 *
 *   { "data": { "awb_number_list": "…", "access_token": "…", "secret_key": "…" } }
 *
 * The reply is keyed BY AWB — `data["1369010468790"]` — not a list, so a lookup
 * for a parcel the account does not own comes back as a `data` object with no
 * such key rather than as an error. That case is reported, never guessed at.
 *
 * NOTHING HERE FABRICATES A SCAN. Every event this returns is one the courier
 * recorded, carrying the courier's own timestamp and location; when the call
 * fails, is unconfigured, or answers about a parcel it does not know, the result
 * is an empty snapshot with a note explaining which of those happened. That is
 * the same contract `PlaceholderTrackingProvider` honours, and it is what lets
 * the console tell "no scans yet" apart from "we could not ask".
 */
final class IthinkLogisticsTrackingProvider implements TrackingProvider
{
    /** Their cap. The interface asks for one parcel at a time; this is the ceiling if that ever changes. */
    public const AWB_PER_CALL = 10;

    /**
     * `current_status` → the five states `shipments.status` is allowed to hold.
     *
     * The vocabulary is the full documented set for forward, return and reverse
     * movements. Anything absent from this map is deliberately left to the
     * caller as "in transit but unrecognised" rather than being forced into a
     * state that would close an order.
     *
     * @var array<string, string>
     */
    private const STATE = [
        // Forward
        'manifested' => 'Dispatched',
        'not picked' => 'Dispatched',
        'picked up' => 'In transit',
        'in transit' => 'In transit',
        'reached at destination' => 'In transit',
        'out for delivery' => 'In transit',
        'delayed' => 'In transit',
        'misrouted' => 'In transit',
        'undelivered' => 'Failed',
        'out of delivery area' => 'Failed',
        'damaged' => 'Failed',
        'lost' => 'Failed',
        'shortage' => 'Failed',
        'delivered' => 'Delivered',
        'cancelled' => 'Cancelled',
        // Return leg
        'rto pending' => 'Failed',
        'rto processing' => 'Failed',
        'rto in transit' => 'Failed',
        'reached at origin' => 'Failed',
        'rto out for delivery' => 'Failed',
        'rto undelivered' => 'Failed',
        'rto shortage' => 'Failed',
        'rto delivered' => 'Delivered',
        // Reverse pickup
        'rev manifest' => 'Dispatched',
        'rev out for pick up' => 'In transit',
        'rev picked up' => 'In transit',
        'rev in transit' => 'In transit',
        'rev out for delivery' => 'In transit',
        'rev closed' => 'In transit',
        'rev cancelled' => 'Cancelled',
        'rev delivered' => 'Delivered',
    ];

    public function __construct(
        private readonly string $baseUrl,
        private readonly string $accessToken,
        private readonly string $secretKey,
        private readonly int $timeout,
        private readonly Logger $logger,
    ) {
    }

    /** Both halves of the credential, or this is not a connection. */
    public function isConnected(): bool
    {
        return $this->baseUrl !== '' && $this->accessToken !== '' && $this->secretKey !== '';
    }

    public function fetch(string $awb, string $carrier): TrackingSnapshot
    {
        $awb = trim($awb);

        if (!$this->isConnected()) {
            return TrackingSnapshot::empty('iThink Logistics credentials are not configured on this server.');
        }

        if ($awb === '') {
            return TrackingSnapshot::empty('This parcel has no AWB yet, so the courier has nothing to look up.');
        }

        $body = $this->call($awb);

        if ($body === null) {
            return TrackingSnapshot::empty('iThink Logistics could not be reached. The scans below are the last ones stored.');
        }

        $envelope = self::intOf($body['status_code'] ?? null);

        if ($envelope !== 200) {
            $this->logger->warning('iThink Logistics refused a tracking call', [
                'awb' => $awb,
                'status_code' => $envelope,
                'message' => is_string($body['message'] ?? null) ? $body['message'] : '',
            ]);
        }

        return self::snapshotFrom($body, $awb);
    }

    /**
     * The documented response body → a snapshot. Pure, and public so it can be
     * driven by the example payload in their docs without opening a socket:
     * everything that can be got wrong here is in the SHAPE of their reply, and
     * a mapping that can only be exercised against the live API is a mapping
     * nobody exercises.
     *
     * @param array<string, mixed> $body
     */
    public static function snapshotFrom(array $body, string $awb): TrackingSnapshot
    {
        /* Their `status_code` is the envelope's, not HTTP's: a 200 response can
           still carry 401 here when the credentials are wrong. */
        $envelope = self::intOf($body['status_code'] ?? null);

        if ($envelope !== 200) {
            return TrackingSnapshot::empty(
                $envelope === 401 || $envelope === 403
                    ? 'iThink Logistics rejected the credentials. Check ITHINK_ACCESS_TOKEN and ITHINK_SECRET_KEY.'
                    : sprintf('iThink Logistics answered %d for this AWB.', $envelope),
            );
        }

        $parcel = is_array($body['data'] ?? null) && is_array($body['data'][$awb] ?? null)
            ? $body['data'][$awb]
            : null;

        if ($parcel === null) {
            return TrackingSnapshot::empty('iThink Logistics does not have a parcel under this AWB.');
        }

        $message = strtolower(self::stringOf($parcel['message'] ?? ''));

        if ($message !== '' && $message !== 'success') {
            return TrackingSnapshot::empty(sprintf('iThink Logistics said: %s', self::stringOf($parcel['message'])));
        }

        return new TrackingSnapshot(
            self::stringOf($parcel['current_status'] ?? '') ?: null,
            self::estimate($parcel),
            self::events($parcel),
            true,
        );
    }

    /**
     * The console's status for a courier status string, or null when the
     * vocabulary is one this map does not cover.
     *
     * Null rather than a guess: an unrecognised status that defaulted to
     * "Delivered" would close an order and make a COD payment collectible.
     */
    public static function consoleStatus(?string $courierStatus): ?string
    {
        return self::STATE[strtolower(trim((string) $courierStatus))] ?? null;
    }

    /**
     * The scan tail, oldest first.
     *
     * `complete` is true for every one of them, and that is not laziness: a scan
     * in this list is an event the courier has ALREADY recorded. The unfinished
     * steps on a tracking page are the internal milestones, which this never
     * touches.
     *
     * @param array<string, mixed> $parcel
     *
     * @return list<array{label: string, detail: string, time: string, complete: bool}>
     */
    private static function events(array $parcel): array
    {
        $scans = is_array($parcel['scan_details'] ?? null) ? $parcel['scan_details'] : [];
        $events = [];

        foreach ($scans as $scan) {
            if (!is_array($scan)) {
                continue;
            }

            $label = self::stringOf($scan['status'] ?? '');

            if ($label === '') {
                continue;
            }

            $events[] = [
                'label' => $label,
                'detail' => self::detail($scan),
                'time' => self::stringOf($scan['scan_date_time'] ?? ''),
                'complete' => true,
            ];
        }

        /* They document no ordering. Sorting by the scan's own timestamp is the
           only thing that makes the tail read as a journey rather than as
           whatever order the courier's database happened to return. */
        usort($events, static fn (array $a, array $b): int => strcmp($a['time'], $b['time']));

        return $events;
    }

    /**
     * One line under the scan: where it happened, and why if the courier said.
     *
     * @param array<string, mixed> $scan
     */
    private static function detail(array $scan): string
    {
        $where = self::stringOf($scan['scan_location'] ?? '');
        $why = self::stringOf($scan['remark'] ?? '');
        $reason = self::stringOf($scan['status_reason'] ?? '');

        // `remark` is the operational line ("CONSIGNEE NOT AVAILABLE"); the
        // reason is the human one and wins when they disagree.
        $note = $reason !== '' ? $reason : $why;

        return implode(' · ', array_values(array_filter([$where, $note], static fn (string $p): bool => $p !== '')));
    }

    /**
     * The delivery date the courier is promising.
     *
     * `expected_delivery_date` is the live estimate and moves with the parcel;
     * `promise_delivery_date` is what was promised at booking. The live one is
     * what a person on a tracking page is asking for.
     *
     * @param array<string, mixed> $parcel
     */
    private static function estimate(array $parcel): ?string
    {
        foreach (['expected_delivery_date', 'promise_delivery_date'] as $field) {
            $value = self::stringOf($parcel[$field] ?? '');

            if ($value !== '') {
                return $value;
            }
        }

        $dates = is_array($parcel['order_date_time'] ?? null) ? $parcel['order_date_time'] : [];
        $delivered = self::stringOf($dates['delivery_date'] ?? '');

        return $delivered === '' ? null : $delivered;
    }

    /**
     * The POST, JSON both ways. Null on any transport or parse failure — the
     * caller turns that into a note, because a shipment screen that throws when
     * a courier's API hiccups is a screen nobody can open.
     *
     * @return array<string, mixed>|null
     */
    private function call(string $awb): ?array
    {
        $url = rtrim($this->baseUrl, '/') . '/order/track.json';
        $handle = curl_init($url);

        if ($handle === false) {
            return null;
        }

        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => $this->timeout,
            // The credentials are in the body, so a redirect would hand them to
            // whatever host answered. There is nothing to follow here anyway.
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Cache-Control: no-cache'],
            CURLOPT_POSTFIELDS => Json::encode([
                'data' => [
                    'awb_number_list' => $awb,
                    'access_token' => $this->accessToken,
                    'secret_key' => $this->secretKey,
                ],
            ]),
        ]);

        $raw = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $transportError = curl_error($handle);
        curl_close($handle);

        if (!is_string($raw) || $raw === '') {
            $this->logger->warning('iThink Logistics call failed at the transport', [
                'awb' => $awb,
                'status' => $status,
                'detail' => $transportError,
            ]);

            return null;
        }

        $decoded = Json::decodeArray($raw);

        if ($decoded === null) {
            /* Truncated, and never the request: the body we SENT carries the
               secret key, the body we received does not. */
            $this->logger->warning('iThink Logistics answered with something that was not JSON', [
                'awb' => $awb,
                'status' => $status,
                'body' => substr($raw, 0, 300),
            ]);

            return null;
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }

    private static function stringOf(mixed $value): string
    {
        return is_string($value) ? trim($value) : (is_int($value) || is_float($value) ? (string) $value : '');
    }

    private static function intOf(mixed $value): int
    {
        return is_int($value) ? $value : (is_string($value) && ctype_digit($value) ? (int) $value : 0);
    }
}

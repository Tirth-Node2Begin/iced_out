<?php

declare(strict_types=1);

namespace Iced\Integration\Mail;

use Iced\Support\Logger;

/**
 * SMTP over a raw socket — RFC 5321, spoken by hand.
 *
 * There is no Composer dependency behind this, for the same reason there is no
 * framework behind the rest of the backend: the protocol is a dozen verbs and
 * one state machine, and the alternative was vendoring a mail library for the
 * three messages this application sends.
 *
 * ENCRYPTION. Two shapes, and the port usually tells you which:
 *   · 465 — implicit TLS. The socket is `ssl://` from the first byte; there is
 *           no plaintext phase and no STARTTLS command.
 *   · 587 — submission. Connect in the clear, EHLO, then STARTTLS upgrades the
 *           existing socket, and EHLO is re-sent because the capability list
 *           from before the upgrade is not binding (RFC 3207 §4.2 — AUTH in
 *           particular is routinely advertised only after it).
 *
 * `none` exists for a local relay (MailHog, Mailpit, a container's postfix) and
 * refuses to send credentials over it: a password on a plaintext socket is a
 * password on the wire, and an unauthenticated local relay does not want one.
 *
 * WHAT IS NOT LOGGED. The password, and the message body. A failure logs the
 * server's reply and the stage it failed at, because that is what tells an
 * operator whether Gmail rejected the app password or the firewall ate 587 —
 * and nothing about who the message was addressed to, which is the
 * account-existence signal the recovery flow is built not to leak.
 */
final class SmtpMailer implements Mailer
{
    /** Read deadline sits a little past the connect timeout so the two never race. */
    private const READ_TIMEOUT_MARGIN = 5;

    /** @var resource|null */
    private mixed $socket = null;

    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $username,
        private readonly string $password,
        /** `tls` (STARTTLS), `ssl` (implicit), or `none`. */
        private readonly string $encryption,
        private readonly string $fromAddress,
        private readonly string $fromName,
        private readonly int $timeout,
        private readonly Logger $logger,
    ) {
    }

    public function isConfigured(): bool
    {
        return $this->host !== '';
    }

    public function name(): string
    {
        return sprintf('%s:%d', $this->host, $this->port);
    }

    public function send(MailMessage $message): void
    {
        if (!$this->isConfigured()) {
            throw new MailFailed('SMTP_HOST is blank — no mail server is configured.');
        }

        try {
            $this->connect();
            $this->handshake();
            $this->authenticate();
            $this->deliver($message);
            $this->command('QUIT', [221]);
        } catch (MailFailed $failure) {
            $this->logger->error('mail.failed', [
                'driver' => 'smtp',
                'server' => $this->name(),
                'reason' => $failure->getMessage(),
            ]);

            throw $failure;
        } finally {
            $this->disconnect();
        }
    }

    private function connect(): void
    {
        $scheme = $this->encryption === 'ssl' ? 'ssl' : 'tcp';
        $errorCode = 0;
        $errorMessage = '';

        $context = stream_context_create(['ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'SNI_enabled' => true,
        ]]);

        $socket = @stream_socket_client(
            sprintf('%s://%s:%d', $scheme, $this->host, $this->port),
            $errorCode,
            $errorMessage,
            $this->timeout,
            STREAM_CLIENT_CONNECT,
            $context,
        );

        if ($socket === false) {
            throw new MailFailed(sprintf(
                'Could not reach %s (%d: %s).',
                $this->name(),
                $errorCode,
                $errorMessage === '' ? 'no detail' : $errorMessage,
            ));
        }

        $this->socket = $socket;
        stream_set_timeout($socket, $this->timeout + self::READ_TIMEOUT_MARGIN);

        // The greeting arrives unprompted; anything but 220 means the server is
        // refusing the conversation before it has started.
        $this->expect([220], 'greeting');
    }

    private function handshake(): void
    {
        $this->command('EHLO ' . $this->clientName(), [250]);

        if ($this->encryption !== 'tls') {
            return;
        }

        $this->command('STARTTLS', [220]);

        $socket = $this->socket;

        if ($socket === null || @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) !== true) {
            throw new MailFailed('The server accepted STARTTLS but the TLS handshake failed.');
        }

        // Re-issued deliberately — see the class note.
        $this->command('EHLO ' . $this->clientName(), [250]);
    }

    private function authenticate(): void
    {
        if ($this->username === '') {
            return;
        }

        if ($this->encryption === 'none') {
            throw new MailFailed(
                'SMTP_USER is set but SMTP_ENCRYPTION is none — refusing to send credentials in the clear.',
            );
        }

        // AUTH LOGIN over AUTH PLAIN: both are base64 of the same secret over
        // the same TLS socket, and LOGIN is the one every submission server in
        // service accepts, Gmail and Outlook included.
        $this->command('AUTH LOGIN', [334]);
        $this->command(base64_encode($this->username), [334]);

        try {
            $this->command(base64_encode($this->password), [235]);
        } catch (MailFailed $failure) {
            throw new MailFailed(
                'The mail server rejected SMTP_USER / SMTP_PASS. For Gmail this must be a '
                . '16-character App Password, not the account password. ('
                . $failure->getMessage() . ')',
            );
        }
    }

    private function deliver(MailMessage $message): void
    {
        $this->command(sprintf('MAIL FROM:<%s>', $this->fromAddress), [250]);
        $this->command(sprintf('RCPT TO:<%s>', $message->to), [250, 251]);
        $this->command('DATA', [354]);

        $this->write($this->body($message) . "\r\n.\r\n");
        $this->expect([250], 'message body');
    }

    /**
     * multipart/alternative: the text part first, the HTML second.
     *
     * Order is the protocol, not a preference — RFC 2046 §5.1.4 has the client
     * show the LAST part it can render, so a plain-text reader stops at the
     * first and everything else shows the second.
     */
    private function body(MailMessage $message): string
    {
        $boundary = 'iox-' . bin2hex(random_bytes(12));
        $from = $this->fromName === ''
            ? $this->fromAddress
            : sprintf('%s <%s>', $this->encodeHeader($this->fromName), $this->fromAddress);

        $headers = [
            'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
            'From: ' . $from,
            'To: <' . $message->to . '>',
            'Subject: ' . $this->encodeHeader($message->subject),
            'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $this->clientName() . '>',
            'MIME-Version: 1.0',
            // A recovery code is not a newsletter. These are what keep it out of
            // bulk folders and out of vacation-responder loops.
            'Auto-Submitted: auto-generated',
            'X-Auto-Response-Suppress: All',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];

        $parts = [
            '--' . $boundary,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode($message->text), 76, "\r\n")),
            '--' . $boundary,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode($message->html), 76, "\r\n")),
            '--' . $boundary . '--',
        ];

        return implode("\r\n", $headers) . "\r\n\r\n" . $this->stuff(implode("\r\n", $parts));
    }

    /**
     * RFC 5321 §4.5.2 — a body line beginning with "." would otherwise end the
     * message early. Base64 never produces one, but the transport must not
     * depend on what the composer above it happens to emit.
     */
    private function stuff(string $body): string
    {
        $normalized = str_replace(["\r\n", "\r", "\n"], "\n", $body);
        $stuffed = preg_replace('/^\./m', '..', $normalized);

        return str_replace("\n", "\r\n", $stuffed ?? $normalized);
    }

    private function encodeHeader(string $value): string
    {
        // 7-bit stays readable in the raw source; anything else is encoded whole
        // rather than risking a split multi-byte character across a fold.
        return preg_match('/[^\x20-\x7E]/', $value) === 1
            ? '=?UTF-8?B?' . base64_encode($value) . '?='
            : $value;
    }

    /**
     * @param list<int> $expected
     */
    private function command(string $line, array $expected): string
    {
        $this->write($line . "\r\n");

        // The credential lines are base64 of a password. The verb is enough
        // context for a log; the argument never is.
        return $this->expect($expected, explode(' ', $line)[0]);
    }

    /**
     * @param list<int> $expected
     */
    private function expect(array $expected, string $stage): string
    {
        $reply = $this->read();
        $code = (int) substr($reply, 0, 3);

        if (!in_array($code, $expected, true)) {
            throw new MailFailed(sprintf('%s: server said %s', $stage, trim($reply)));
        }

        return $reply;
    }

    /** Reads one reply, following the `250-` continuation form to its `250 ` last line. */
    private function read(): string
    {
        $socket = $this->socket;

        if ($socket === null) {
            throw new MailFailed('The connection closed before a reply arrived.');
        }

        $reply = '';

        while (true) {
            $line = fgets($socket, 1024);

            if ($line === false) {
                $meta = stream_get_meta_data($socket);

                throw new MailFailed(
                    ($meta['timed_out'] ?? false) === true
                        ? sprintf('The server stopped replying after %d seconds.', $this->timeout)
                        : 'The connection closed mid-reply.',
                );
            }

            $reply .= $line;

            // "250-SIZE" continues; "250 SIZE" is the last line of the reply.
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }

        return $reply;
    }

    private function write(string $payload): void
    {
        $socket = $this->socket;

        if ($socket === null || @fwrite($socket, $payload) === false) {
            throw new MailFailed('The connection dropped while sending.');
        }
    }

    /**
     * The EHLO argument. Servers check it loosely, but "localhost" is scored as
     * spam by some of them, so the sender's own domain is used when there is one.
     */
    private function clientName(): string
    {
        $at = strrchr($this->fromAddress, '@');

        return $at === false ? 'localhost' : substr($at, 1);
    }

    private function disconnect(): void
    {
        if ($this->socket !== null) {
            @fclose($this->socket);
            $this->socket = null;
        }
    }
}

<?php

declare(strict_types=1);

namespace Iced\Service\Auth;

use Iced\Integration\Mail\MailMessage;

/**
 * The one message this flow sends, in both parts.
 *
 * It is written to be read in a notification banner, because that is where most
 * of these are read: the six digits are the first thing in the subject line and
 * the first thing in the body, and everything else is below them.
 *
 * The HTML is table-and-inline-styles by necessity — mail clients have no
 * flexbox, no grid, no `<style>` in half of them, and Outlook renders through
 * Word. It is deliberately plain: a recovery code that arrives looking like a
 * marketing email is a recovery code people report as phishing.
 *
 * NOTHING HERE IS A LINK. No reset URL, no tracking pixel, no button. A code
 * typed back into a page the person already had open cannot be phished by a
 * lookalike domain in an email, which is the whole reason this flow is digits
 * rather than a magic link.
 */
final class RecoveryEmail
{
    public function __construct(
        private readonly string $storeName = 'Iced_out',
    ) {
    }

    public function forCustomer(string $to, string $name, string $code, int $ttlMinutes): MailMessage
    {
        return $this->compose(
            $to,
            $name,
            $code,
            $ttlMinutes,
            sprintf('%s — your password reset code', $this->storeName),
            'to reset the password on your ' . $this->storeName . ' account',
            'If you did not ask for this, ignore this email — your password has not changed.',
        );
    }

    public function forStaff(string $to, string $name, string $code, int $ttlMinutes): MailMessage
    {
        return $this->compose(
            $to,
            $name,
            $code,
            $ttlMinutes,
            sprintf('%s CRM — your console recovery code', $this->storeName),
            'to reset the password on your ' . $this->storeName . ' operations console account',
            // A staff account opens the whole shop's data. An unexpected code
            // for one is an incident, not a nuisance, and the copy says so.
            'If you did not ask for this, do not enter the code — tell whoever '
                . 'administers the console, because somebody has your work email '
                . 'and is trying the recovery flow with it.',
        );
    }

    private function compose(
        string $to,
        string $name,
        string $code,
        int $ttlMinutes,
        string $subject,
        string $purpose,
        string $warning,
    ): MailMessage {
        $greeting = trim($name) === '' ? 'Hello,' : sprintf('Hello %s,', $this->firstName($name));
        $expiry = sprintf('The code is good for %d minute%s and can be used once.', $ttlMinutes, $ttlMinutes === 1 ? '' : 's');

        $text = implode("\n", [
            $greeting,
            '',
            'Your code is ' . $code,
            '',
            'Enter it on the page you started ' . $purpose . '.',
            $expiry,
            '',
            $warning,
            '',
            '— ' . $this->storeName,
        ]);

        // Letter-spacing on the digits, because a six-digit code read off a
        // phone and typed into a laptop is where transcription errors live.
        $html = <<<HTML
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0c;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              <tr>
                <td align="center">
                  <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="width:440px;max-width:92%;background:#141416;border:1px solid #26262a;border-radius:14px;">
                    <tr>
                      <td style="padding:30px 32px 8px;">
                        <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a8a92;">{$this->escape($this->storeName)}</p>
                        <p style="margin:18px 0 0;font-size:15px;line-height:1.55;color:#e8e8ea;">{$this->escape($greeting)}</p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:22px 32px 6px;">
                        <div style="display:inline-block;padding:16px 26px;background:#0b0b0c;border:1px solid #303036;border-radius:10px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:31px;letter-spacing:.34em;color:#ffffff;">{$this->escape($code)}</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 32px 4px;">
                        <p style="margin:0;font-size:14px;line-height:1.6;color:#b6b6bd;">Enter it on the page you started {$this->escape($purpose)}.</p>
                        <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#8a8a92;">{$this->escape($expiry)}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px 32px 30px;">
                        <p style="margin:0;padding-top:18px;border-top:1px solid #26262a;font-size:12px;line-height:1.65;color:#78787f;">{$this->escape($warning)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            HTML;

        return new MailMessage($to, $subject, $text, $html);
    }

    /** The name people are called by. "Aarav Desai" is greeted as Aarav. */
    private function firstName(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name));

        return $parts === false || $parts === [] ? $name : $parts[0];
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

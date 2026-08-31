<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Kernel\Exception\ValidationException;

/**
 * Request-shape validation. Rules are declared per route in config/routes/*.php
 * and are deliberately small: the domain rules live in services, this only
 * rejects malformed payloads before a controller ever sees them.
 *
 * Rule strings: required|string|int|number|bool|array|email|mobile|pincode|
 *               min:N|max:N|between:A,B|in:a,b,c|regex:/…/|nullable
 */
final class Validator
{
    public const EMAIL_PATTERN = '/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/';
    public const PINCODE_PATTERN = '/^[1-9][0-9]{5}$/';

    /**
     * @param array<string, mixed>  $input
     * @param array<string, string> $rules  field => 'required|string|max:120'
     *
     * @return array<string, mixed> the validated subset, cast to declared types
     *
     * @throws ValidationException
     */
    public function validate(array $input, array $rules, string $errorCode = 'ICE-REQ-422'): array
    {
        $clean = [];
        /** @var list<array{field: string, detail: string}> $errors */
        $errors = [];

        foreach ($rules as $field => $ruleString) {
            $parts = array_filter(explode('|', $ruleString), static fn (string $r): bool => $r !== '');
            $isRequired = in_array('required', $parts, true);
            $isNullable = in_array('nullable', $parts, true);
            $present = array_key_exists($field, $input);
            $value = $present ? $input[$field] : null;

            if (!$present || $value === null || $value === '') {
                if ($isRequired && !($isNullable && $present && $value === null)) {
                    $errors[] = ['field' => $field, 'detail' => 'This field is required.'];

                    continue;
                }

                if ($present && $isNullable) {
                    $clean[$field] = null;
                }

                continue;
            }

            $failure = null;

            foreach ($parts as $rule) {
                [$name, $argument] = array_pad(explode(':', $rule, 2), 2, null);

                switch ($name) {
                    case 'string':
                        if (!is_string($value)) {
                            $failure = 'Must be text.';
                        } else {
                            $value = trim($value);
                        }

                        break;

                    case 'int':
                        if (is_int($value)) {
                            break;
                        }

                        if (is_string($value) && preg_match('/^-?\d+$/', $value) === 1) {
                            $value = (int) $value;
                        } else {
                            $failure = 'Must be a whole number.';
                        }

                        break;

                    case 'number':
                        if (!is_numeric($value)) {
                            $failure = 'Must be a number.';
                        } else {
                            $value = (float) $value;
                        }

                        break;

                    case 'bool':
                        if (is_bool($value)) {
                            break;
                        }

                        if (in_array($value, ['true', 'false', 0, 1, '0', '1'], true)) {
                            $value = in_array($value, ['true', 1, '1'], true);
                        } else {
                            $failure = 'Must be true or false.';
                        }

                        break;

                    case 'array':
                        if (!is_array($value)) {
                            $failure = 'Must be a list.';
                        }

                        break;

                    case 'email':
                        if (!is_string($value) || preg_match(self::EMAIL_PATTERN, $value) !== 1) {
                            $failure = 'Enter a valid email address.';
                        }

                        break;

                    case 'mobile':
                        $normalized = is_string($value) ? self::normalizeMobile($value) : null;

                        if ($normalized === null) {
                            $failure = 'Enter a 10-digit Indian mobile number.';
                        } else {
                            $value = $normalized;
                        }

                        break;

                    case 'pincode':
                        if (!is_string($value) || preg_match(self::PINCODE_PATTERN, $value) !== 1) {
                            $failure = 'Enter a valid 6-digit PIN code.';
                        }

                        break;

                    case 'min':
                        $min = (int) $argument;

                        if (is_string($value) && mb_strlen($value) < $min) {
                            $failure = sprintf('Must be at least %d characters.', $min);
                        } elseif (is_int($value) && $value < $min) {
                            $failure = sprintf('Must be at least %d.', $min);
                        } elseif (is_array($value) && count($value) < $min) {
                            $failure = sprintf('Needs at least %d entries.', $min);
                        }

                        break;

                    case 'max':
                        $max = (int) $argument;

                        if (is_string($value) && mb_strlen($value) > $max) {
                            $failure = sprintf('Must be %d characters or fewer.', $max);
                        } elseif (is_int($value) && $value > $max) {
                            $failure = sprintf('Must be %d or lower.', $max);
                        } elseif (is_array($value) && count($value) > $max) {
                            $failure = sprintf('Allows at most %d entries.', $max);
                        }

                        break;

                    case 'in':
                        $allowed = explode(',', (string) $argument);

                        if (!in_array((string) (is_scalar($value) ? $value : ''), $allowed, true)) {
                            $failure = 'That value is not allowed here.';
                        }

                        break;

                    case 'regex':
                        if (!is_string($value) || preg_match((string) $argument, $value) !== 1) {
                            $failure = 'That value is not in the expected format.';
                        }

                        break;
                }

                if ($failure !== null) {
                    break;
                }
            }

            if ($failure !== null) {
                $errors[] = ['field' => $field, 'detail' => $failure];

                continue;
            }

            $clean[$field] = $value;
        }

        if ($errors !== []) {
            throw new ValidationException('Please check the highlighted fields.', $errors, $errorCode);
        }

        return $clean;
    }

    /** Mirrors the frontend's checkout-validation.ts: +91/0 prefixes stripped, must start 6–9. */
    public static function normalizeMobile(string $raw): ?string
    {
        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        if (str_starts_with($digits, '91') && strlen($digits) === 12) {
            $digits = substr($digits, 2);
        } elseif (str_starts_with($digits, '0') && strlen($digits) === 11) {
            $digits = substr($digits, 1);
        }

        return preg_match('/^[6-9][0-9]{9}$/', $digits) === 1 ? $digits : null;
    }
}

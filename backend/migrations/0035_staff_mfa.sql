-- Time-based one-time passwords for console accounts.
--
-- ── WHY THE CONSOLE AND NOT THE SHOP ────────────────────────────────────────
--
-- A staff account opens every order, every customer record, every payment and
-- the settings that govern session lifetimes and lockout thresholds. A shopper
-- account opens one person's own history. The console is where a stolen password
-- costs the most, and it is also where the population is small enough that
-- enrolment is a conversation rather than a support burden.
--
-- ── OPT-IN, AND OFF UNTIL SOMEBODY TURNS IT ON ──────────────────────────────
--
-- A row exists only once an account starts enrolling, and `confirmed_at` stays
-- NULL until they have proved they can generate a code. Sign-in is completely
-- unchanged for every account without a confirmed row, which is all of them the
-- moment this migration runs. Nobody is locked out by deploying it.
--
-- ── WHAT IS STORED ──────────────────────────────────────────────────────────
--
-- `secret` is the shared TOTP secret, base32, and it is the one thing here that
-- must never leak: anyone holding it can generate valid codes forever. It is
-- stored as issued because TOTP is a SYMMETRIC scheme — the server has to
-- compute the same code the phone does, so it cannot be hashed the way a
-- password is. That is a property of the algorithm, not a shortcut. What follows
-- from it is that this column is exactly as sensitive as `password_hash` is not:
-- a database dump plus this column IS the second factor.
--
-- `recovery_codes` holds HASHES, not codes — those are single-use and verified
-- by comparison, so they can and must be hashed like passwords.
--
-- `failed_attempts` and `locked_until` throttle code guessing. Six digits is a
-- million possibilities and TOTP accepts a window of them, so an unthrottled
-- verify endpoint is brute-forceable in hours.

CREATE TABLE user_mfa (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,

    -- Base32, RFC 4648. Symmetric by necessity — see above.
    secret          VARCHAR(64)     NOT NULL,

    -- NULL until a generated code has been proved. An unconfirmed row never
    -- gates a sign-in, so an abandoned enrolment cannot lock anybody out.
    confirmed_at    DATETIME(6)     NULL,

    -- JSON array of password-hashed single-use codes.
    recovery_codes  TEXT            NULL,

    -- The last time step counted, so a code cannot be replayed inside its own
    -- thirty-second window by somebody watching the network.
    last_used_step  BIGINT UNSIGNED NULL,

    failed_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until    DATETIME(6)     NULL,

    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    -- One enrolment per account.
    UNIQUE KEY uq_user_mfa_user (user_id),
    CONSTRAINT fk_user_mfa_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- The half-finished sign-in: a password accepted, a second factor still owed.
--
-- A separate table rather than a flag on `user_sessions`, because it is NOT a
-- session — it grants nothing. It is a short-lived ticket saying "this password
-- was correct two minutes ago", and conflating the two would mean a row in
-- `user_sessions` that authenticates nobody, which every query joining that
-- table would then have to remember to exclude.
CREATE TABLE mfa_challenges (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NOT NULL,
    audience     VARCHAR(16)     NOT NULL,

    -- HMAC of the ticket, exactly as session tokens are stored: the raw value
    -- goes to the browser once and is never written down here.
    token_hash   BINARY(32)      NOT NULL,

    ip           VARCHAR(45)     NOT NULL DEFAULT '',
    user_agent   VARCHAR(255)    NOT NULL DEFAULT '',
    consumed_at  DATETIME(6)     NULL,

    -- Five minutes. Long enough to open an authenticator app, short enough that
    -- a ticket left on a shared machine is worthless by the time anyone finds it.
    expires_at   DATETIME(6)     NOT NULL,
    created_at   DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_mfa_challenges_token (token_hash),
    KEY ix_mfa_challenges_expiry (expires_at),
    CONSTRAINT fk_mfa_challenges_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

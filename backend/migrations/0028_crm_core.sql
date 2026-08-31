-- CRM core — the relationship layer the operations console did not have.
--
-- The console tells you what the shop DID: orders placed, parcels moved, money
-- taken. None of it tells you who you are talking to, what you owe them a reply
-- about, or which conversation is worth money. These eight tables are that
-- second half, and they sit BESIDE the commerce schema rather than inside it:
-- nothing here is a foreign key any order, payment or shipment depends on, so
-- the storefront runs untouched whether the CRM is deployed or not.
--
-- Two links point the other way, both nullable:
--   crm_contacts.user_id  -> users.id    a CRM contact that is also a shopper
--   crm_deals.order_id    -> orders.id   the deal that became a real sale
-- Both are ON DELETE SET NULL. Losing the commerce row must never take the
-- relationship history with it — the note about why they walked away is the
-- part you keep.

CREATE TABLE crm_companies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    name VARCHAR(160) NOT NULL,
    name_normalized VARCHAR(160) NOT NULL,
    domain VARCHAR(190) NOT NULL DEFAULT '',
    industry VARCHAR(80) NOT NULL DEFAULT '',
    size_band VARCHAR(16) NOT NULL DEFAULT '',
    email VARCHAR(190) NOT NULL DEFAULT '',
    phone VARCHAR(20) NOT NULL DEFAULT '',
    website VARCHAR(190) NOT NULL DEFAULT '',
    city VARCHAR(80) NOT NULL DEFAULT '',
    state VARCHAR(80) NOT NULL DEFAULT '',
    country VARCHAR(80) NOT NULL DEFAULT 'India',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    owner_user_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_companies_public_id (public_id),
    KEY ix_crm_companies_name (name_normalized),
    KEY ix_crm_companies_owner (owner_user_id, deleted_at),
    CONSTRAINT ck_crm_companies_status CHECK (status IN ('ACTIVE','ARCHIVED')),
    CONSTRAINT ck_crm_companies_size CHECK (size_band IN ('','1-10','11-50','51-200','201-500','500+')),
    CONSTRAINT fk_crm_companies_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- A person. `user_id` is the bridge to the storefront account when the same
-- human has one; it stays NULL for everyone the shop knows but has never sold
-- to — a wholesale buyer, a stylist, a press contact.
CREATE TABLE crm_contacts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    company_id BIGINT UNSIGNED NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL DEFAULT '',
    email VARCHAR(190) NOT NULL DEFAULT '',
    email_normalized VARCHAR(190) NOT NULL DEFAULT '',
    phone VARCHAR(20) NOT NULL DEFAULT '',
    job_title VARCHAR(120) NOT NULL DEFAULT '',
    lifecycle VARCHAR(16) NOT NULL DEFAULT 'LEAD',
    source VARCHAR(24) NOT NULL DEFAULT 'OTHER',
    city VARCHAR(80) NOT NULL DEFAULT '',
    state VARCHAR(80) NOT NULL DEFAULT '',
    country VARCHAR(80) NOT NULL DEFAULT 'India',
    owner_user_id BIGINT UNSIGNED NULL,
    last_activity_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_contacts_public_id (public_id),
    -- Not UNIQUE: two contacts may legitimately share a household address, and a
    -- blank email must not collide with every other blank one.
    KEY ix_crm_contacts_email (email_normalized),
    KEY ix_crm_contacts_user (user_id),
    KEY ix_crm_contacts_company (company_id, deleted_at),
    KEY ix_crm_contacts_owner (owner_user_id, deleted_at),
    KEY ix_crm_contacts_lifecycle (lifecycle, deleted_at),
    CONSTRAINT ck_crm_contacts_lifecycle CHECK (lifecycle IN ('SUBSCRIBER','LEAD','QUALIFIED','CUSTOMER','CHURNED')),
    CONSTRAINT ck_crm_contacts_source CHECK (source IN ('WEBSITE','INSTAGRAM','REFERRAL','WALK_IN','CAMPAIGN','SUPPORT','IMPORT','OTHER')),
    CONSTRAINT fk_crm_contacts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_crm_contacts_company FOREIGN KEY (company_id) REFERENCES crm_companies (id) ON DELETE SET NULL,
    CONSTRAINT fk_crm_contacts_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Unqualified interest. A lead is deliberately a FLAT row with free-text company
-- and no foreign keys into contacts: it is what arrived, before anyone decided
-- whether it is worth a record. Qualifying it writes a contact (and optionally a
-- company and a deal) and stamps the three converted_* columns.
CREATE TABLE crm_leads (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(190) NOT NULL DEFAULT '',
    email_normalized VARCHAR(190) NOT NULL DEFAULT '',
    phone VARCHAR(20) NOT NULL DEFAULT '',
    company_name VARCHAR(160) NOT NULL DEFAULT '',
    source VARCHAR(24) NOT NULL DEFAULT 'WEBSITE',
    status VARCHAR(16) NOT NULL DEFAULT 'NEW',
    score TINYINT UNSIGNED NOT NULL DEFAULT 0,
    message TEXT NULL,
    owner_user_id BIGINT UNSIGNED NULL,
    converted_contact_id BIGINT UNSIGNED NULL,
    converted_deal_id BIGINT UNSIGNED NULL,
    converted_at DATETIME(6) NULL,
    lost_reason VARCHAR(190) NOT NULL DEFAULT '',
    last_activity_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_leads_public_id (public_id),
    KEY ix_crm_leads_status (status, deleted_at),
    KEY ix_crm_leads_owner (owner_user_id, deleted_at),
    KEY ix_crm_leads_email (email_normalized),
    KEY ix_crm_leads_created (created_at),
    CONSTRAINT ck_crm_leads_status CHECK (status IN ('NEW','CONTACTED','QUALIFIED','UNQUALIFIED','CONVERTED')),
    CONSTRAINT ck_crm_leads_source CHECK (source IN ('WEBSITE','INSTAGRAM','REFERRAL','WALK_IN','CAMPAIGN','SUPPORT','IMPORT','OTHER')),
    CONSTRAINT ck_crm_leads_score CHECK (score BETWEEN 0 AND 100),
    CONSTRAINT fk_crm_leads_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_crm_leads_contact FOREIGN KEY (converted_contact_id) REFERENCES crm_contacts (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE crm_pipelines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_pipelines_public_id (public_id),
    UNIQUE KEY uq_crm_pipelines_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- `kind` is what makes a board computable: OPEN columns sum into the forecast,
-- WON and LOST are terminal and are what the win-rate is measured from. Without
-- it every board would need its stage names hard-coded somewhere in PHP.
CREATE TABLE crm_stages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    pipeline_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    kind VARCHAR(8) NOT NULL DEFAULT 'OPEN',
    probability TINYINT UNSIGNED NOT NULL DEFAULT 0,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_stages_public_id (public_id),
    UNIQUE KEY uq_crm_stages_slug_per_pipeline (pipeline_id, slug),
    KEY ix_crm_stages_board (pipeline_id, position),
    CONSTRAINT ck_crm_stages_kind CHECK (kind IN ('OPEN','WON','LOST')),
    CONSTRAINT ck_crm_stages_probability CHECK (probability BETWEEN 0 AND 100),
    CONSTRAINT fk_crm_stages_pipeline FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- The money conversation. DECIMAL(12,2) to match orders.total exactly, so a deal
-- and the order it became are the same number in the same type — comparing them
-- never goes through a float.
CREATE TABLE crm_deals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    title VARCHAR(190) NOT NULL,
    pipeline_id BIGINT UNSIGNED NOT NULL,
    stage_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NULL,
    company_id BIGINT UNSIGNED NULL,
    order_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(8) NOT NULL DEFAULT 'OPEN',
    probability TINYINT UNSIGNED NOT NULL DEFAULT 0,
    source VARCHAR(24) NOT NULL DEFAULT 'OTHER',
    expected_close_on DATE NULL,
    closed_at DATETIME(6) NULL,
    lost_reason VARCHAR(190) NOT NULL DEFAULT '',
    owner_user_id BIGINT UNSIGNED NULL,
    -- Rank WITHIN a stage column, so a board drag is one UPDATE and the order
    -- survives a reload. Gap-numbered by hundreds on insert (see DealRepository).
    position INT NOT NULL DEFAULT 0,
    last_activity_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_deals_public_id (public_id),
    KEY ix_crm_deals_board (pipeline_id, stage_id, position),
    KEY ix_crm_deals_contact (contact_id, deleted_at),
    KEY ix_crm_deals_company (company_id, deleted_at),
    KEY ix_crm_deals_owner (owner_user_id, status, deleted_at),
    KEY ix_crm_deals_closed (status, closed_at),
    CONSTRAINT ck_crm_deals_status CHECK (status IN ('OPEN','WON','LOST')),
    CONSTRAINT ck_crm_deals_probability CHECK (probability BETWEEN 0 AND 100),
    CONSTRAINT ck_crm_deals_amount CHECK (amount >= 0),
    CONSTRAINT fk_crm_deals_pipeline FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines (id) ON DELETE CASCADE,
    CONSTRAINT fk_crm_deals_stage FOREIGN KEY (stage_id) REFERENCES crm_stages (id) ON DELETE CASCADE,
    CONSTRAINT fk_crm_deals_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts (id) ON DELETE SET NULL,
    CONSTRAINT fk_crm_deals_company FOREIGN KEY (company_id) REFERENCES crm_companies (id) ON DELETE SET NULL,
    CONSTRAINT fk_crm_deals_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
    CONSTRAINT fk_crm_deals_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Tasks, calls, meetings and logged emails — one table, because "what is due"
-- and "what happened" are the same question asked either side of `completed_at`.
--
-- subject_type/subject_id is a POLYMORPHIC pointer with no foreign key on
-- purpose: an activity can hang off a lead, a contact, a company, a deal or an
-- order, and five nullable FK columns would be four NULLs on every row. The
-- CHECK keeps the type list honest; orphans are swept by the repository.
CREATE TABLE crm_activities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    type VARCHAR(12) NOT NULL DEFAULT 'TASK',
    subject VARCHAR(190) NOT NULL,
    body TEXT NULL,
    subject_type VARCHAR(12) NOT NULL,
    subject_id BIGINT UNSIGNED NOT NULL,
    due_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    outcome VARCHAR(190) NOT NULL DEFAULT '',
    priority VARCHAR(8) NOT NULL DEFAULT 'NORMAL',
    owner_user_id BIGINT UNSIGNED NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_activities_public_id (public_id),
    KEY ix_crm_activities_subject (subject_type, subject_id, deleted_at),
    -- The "my day" query: everything open, mine, ordered by when it is due.
    KEY ix_crm_activities_due (owner_user_id, completed_at, due_at),
    KEY ix_crm_activities_open (completed_at, due_at),
    CONSTRAINT ck_crm_activities_type CHECK (type IN ('TASK','CALL','MEETING','EMAIL','WHATSAPP')),
    CONSTRAINT ck_crm_activities_priority CHECK (priority IN ('LOW','NORMAL','HIGH')),
    CONSTRAINT ck_crm_activities_subject_type CHECK (subject_type IN ('lead','contact','company','deal','order')),
    CONSTRAINT fk_crm_activities_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_crm_activities_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE crm_notes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    subject_type VARCHAR(12) NOT NULL,
    subject_id BIGINT UNSIGNED NOT NULL,
    body TEXT NOT NULL,
    pinned TINYINT(1) NOT NULL DEFAULT 0,
    author_user_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_crm_notes_public_id (public_id),
    KEY ix_crm_notes_subject (subject_type, subject_id, pinned, created_at),
    CONSTRAINT ck_crm_notes_subject_type CHECK (subject_type IN ('lead','contact','company','deal','order')),
    CONSTRAINT fk_crm_notes_author FOREIGN KEY (author_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- The one pipeline every install starts with. Deliberately seeded HERE rather
-- than in seeds/: a board with no stages is not an empty board, it is a broken
-- screen, and the deals module cannot render without at least one stage row.
INSERT INTO crm_pipelines (public_id, name, slug, is_default, position)
VALUES ('pipe-01', 'Sales', 'sales', 1, 0);

INSERT INTO crm_stages (public_id, pipeline_id, name, slug, kind, probability, position)
SELECT 'stage-01', id, 'New', 'new', 'OPEN', 10, 0 FROM crm_pipelines WHERE slug = 'sales'
UNION ALL SELECT 'stage-02', id, 'Qualified', 'qualified', 'OPEN', 30, 1 FROM crm_pipelines WHERE slug = 'sales'
UNION ALL SELECT 'stage-03', id, 'Proposal', 'proposal', 'OPEN', 55, 2 FROM crm_pipelines WHERE slug = 'sales'
UNION ALL SELECT 'stage-04', id, 'Negotiation', 'negotiation', 'OPEN', 75, 3 FROM crm_pipelines WHERE slug = 'sales'
UNION ALL SELECT 'stage-05', id, 'Won', 'won', 'WON', 100, 4 FROM crm_pipelines WHERE slug = 'sales'
UNION ALL SELECT 'stage-06', id, 'Lost', 'lost', 'LOST', 0, 5 FROM crm_pipelines WHERE slug = 'sales';

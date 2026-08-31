import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// 1. Tenants (Multi-tenancy baseline)
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).unique(),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  apiKeyHash: varchar('api_key_hash', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Telegram Users
export const telegramUsers = pgTable(
  'telegram_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    telegramId: bigint('telegram_id', { mode: 'number' }).unique().notNull(),
    username: varchar('username', { length: 255 }),
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    isAdmin: boolean('is_admin').default(false).notNull(),
    isBlocked: boolean('is_blocked').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_tg_user_id').on(table.telegramId)]
);

// 4. PAN Profiles (Zero-leakage encrypted storage)
export const panProfiles = pgTable(
  'pan_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }),
    panEncrypted: text('pan_encrypted').notNull(), // AES-256-GCM ciphertext
    panHash: varchar('pan_hash', { length: 128 }).notNull(), // HMAC-SHA256 indexable hash
    panLast4: varchar('pan_last4', { length: 4 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_pan_hash').on(table.panHash),
    index('idx_pan_owner').on(table.ownerUserId),
  ]
);

// 5. IPO Master Database
export const ipoMaster = pgTable(
  'ipo_master',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    symbol: varchar('symbol', { length: 50 }).notNull(),
    companyName: varchar('company_name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).unique().notNull(),
    isin: varchar('isin', { length: 50 }),
    exchange: varchar('exchange', { length: 20 }).default('NSE').notNull(), // NSE, BSE, BOTH
    issueType: varchar('issue_type', { length: 50 }).default('BOOK_BUILT').notNull(),
    mainboardOrSme: varchar('mainboard_or_sme', { length: 20 }).default('MAINBOARD').notNull(),
    status: varchar('status', { length: 50 }).default('UPCOMING').notNull(),

    openDate: timestamp('open_date', { withTimezone: true }),
    closeDate: timestamp('close_date', { withTimezone: true }),
    allotmentDate: timestamp('allotment_date', { withTimezone: true }),
    refundDate: timestamp('refund_date', { withTimezone: true }),
    dematCreditDate: timestamp('demat_credit_date', { withTimezone: true }),
    listingDate: timestamp('listing_date', { withTimezone: true }),

    faceValue: numeric('face_value', { precision: 10, scale: 2 }),
    priceBandMin: numeric('price_band_min', { precision: 10, scale: 2 }),
    priceBandMax: numeric('price_band_max', { precision: 10, scale: 2 }),
    issuePrice: numeric('issue_price', { precision: 10, scale: 2 }),
    lotSize: integer('lot_size').default(1).notNull(),
    minimumApplication: integer('minimum_application').default(1).notNull(),
    issueSize: numeric('issue_size', { precision: 15, scale: 2 }), // In Crores INR

    registrar: varchar('registrar', { length: 100 }), // MUFG_INTIME, KFINTECH, BIGSHARE, etc.
    registrarUrl: varchar('registrar_url', { length: 500 }),

    subscriptionQib: numeric('subscription_qib', { precision: 8, scale: 2 }).default('0'),
    subscriptionNii: numeric('subscription_nii', { precision: 8, scale: 2 }).default('0'),
    subscriptionRetail: numeric('subscription_retail', { precision: 8, scale: 2 }).default('0'),
    subscriptionEmployee: numeric('subscription_employee', { precision: 8, scale: 2 }).default('0'),
    subscriptionTotal: numeric('subscription_total', { precision: 8, scale: 2 }).default('0'),

    gmp: numeric('gmp', { precision: 10, scale: 2 }).default('0'),
    gmpPercentage: numeric('gmp_percentage', { precision: 6, scale: 2 }).default('0'),

    source: varchar('source', { length: 100 }).default('SYSTEM').notNull(),
    sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ipo_status').on(table.status),
    index('idx_ipo_symbol').on(table.symbol),
    index('idx_ipo_dates').on(table.openDate, table.closeDate, table.allotmentDate),
  ]
);

// 6. IPO Subscription Snapshots
export const ipoSubscriptionSnapshots = pgTable(
  'ipo_subscription_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ipoId: uuid('ipo_id')
      .references(() => ipoMaster.id, { onDelete: 'cascade' })
      .notNull(),
    qib: numeric('qib', { precision: 8, scale: 2 }).notNull(),
    nii: numeric('nii', { precision: 8, scale: 2 }).notNull(),
    retail: numeric('retail', { precision: 8, scale: 2 }).notNull(),
    employee: numeric('employee', { precision: 8, scale: 2 }).default('0'),
    total: numeric('total', { precision: 8, scale: 2 }).notNull(),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_sub_ipo_time').on(table.ipoId, table.snapshotAt)]
);

// 7. IPO Applications
export const ipoApplications = pgTable(
  'ipo_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    panProfileId: uuid('pan_profile_id')
      .references(() => panProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    ipoId: uuid('ipo_id')
      .references(() => ipoMaster.id, { onDelete: 'cascade' })
      .notNull(),
    applicationNumber: varchar('application_number', { length: 100 }),
    source: varchar('source', { length: 100 }).notNull(),
    bidQuantity: integer('bid_quantity').default(0).notNull(),
    bidPrice: numeric('bid_price', { precision: 10, scale: 2 }).default('0'),
    amount: numeric('amount', { precision: 12, scale: 2 }).default('0'),
    applicationStatus: varchar('application_status', { length: 50 }).default('PENDING').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_uniq_app').on(
      table.panProfileId,
      table.ipoId,
      table.applicationNumber,
      table.source
    ),
  ]
);

// 8. Allotment Results
export const allotmentResults = pgTable(
  'allotment_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    panProfileId: uuid('pan_profile_id').references(() => panProfiles.id, { onDelete: 'set null' }),
    panHash: varchar('pan_hash', { length: 128 }).notNull(),
    ipoId: uuid('ipo_id')
      .references(() => ipoMaster.id, { onDelete: 'cascade' })
      .notNull(),
    applicationNumber: varchar('application_number', { length: 100 }),
    status: varchar('status', { length: 50 }).notNull(), // ALLOTTED, NOT_ALLOTTED, PENDING, etc.
    appliedQuantity: integer('applied_quantity').default(0),
    allottedQuantity: integer('allotted_quantity').default(0),
    issuePrice: numeric('issue_price', { precision: 10, scale: 2 }).default('0'),
    amountApplied: numeric('amount_applied', { precision: 12, scale: 2 }).default('0'),
    amountAllotted: numeric('amount_allotted', { precision: 12, scale: 2 }).default('0'),
    refundAmount: numeric('refund_amount', { precision: 12, scale: 2 }).default('0'),
    dematCreditStatus: varchar('demat_credit_status', { length: 100 }),
    source: varchar('source', { length: 100 }).notNull(),
    confidence: varchar('confidence', { length: 20 }).default('HIGH').notNull(),
    rawReference: text('raw_reference'),
    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_allot_pan_ipo').on(table.panHash, table.ipoId, table.checkedAt),
    index('idx_allot_fingerprint').on(table.fingerprint),
  ]
);

// 9. Allotment Checks (Audit log of raw queries & latency)
export const allotmentChecks = pgTable(
  'allotment_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    panHash: varchar('pan_hash', { length: 128 }).notNull(),
    ipoId: uuid('ipo_id').references(() => ipoMaster.id, { onDelete: 'set null' }),
    provider: varchar('provider', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    rawResponse: jsonb('raw_response'),
    durationMs: integer('duration_ms').notNull(),
    errorCode: varchar('error_code', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_checks_pan_time').on(table.panHash, table.createdAt),
    index('idx_checks_provider').on(table.provider, table.status),
  ]
);

// 10. Bulk Jobs & Items
export const bulkJobs = pgTable('bulk_jobs', {
  id: varchar('id', { length: 50 }).primaryKey(), // BULK-XXXXX
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  totalPans: integer('total_pans').notNull(),
  processedPans: integer('processed_pans').default(0).notNull(),
  successfulPans: integer('successful_pans').default(0).notNull(),
  partialPans: integer('partial_pans').default(0).notNull(),
  failedPans: integer('failed_pans').default(0).notNull(),
  allottedCount: integer('allotted_count').default(0).notNull(),
  notAllottedCount: integer('not_allotted_count').default(0).notNull(),
  pendingCount: integer('pending_count').default(0).notNull(),
  status: varchar('status', { length: 50 }).default('QUEUED').notNull(), // QUEUED, PROCESSING, COMPLETED, FAILED
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const bulkJobItems = pgTable(
  'bulk_job_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bulkJobId: varchar('bulk_job_id', { length: 50 })
      .references(() => bulkJobs.id, { onDelete: 'cascade' })
      .notNull(),
    panHash: varchar('pan_hash', { length: 128 }).notNull(),
    panLast4: varchar('pan_last4', { length: 4 }).notNull(),
    label: varchar('label', { length: 255 }),
    status: varchar('status', { length: 50 }).default('PENDING').notNull(),
    allottedIposCount: integer('allotted_ipos_count').default(0).notNull(),
    errorMessage: text('error_message'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [index('idx_bulk_item_job').on(table.bulkJobId, table.status)]
);

// 11. Notification Channels & Events
export const notificationChannels = pgTable('notification_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  telegramChatId: bigint('telegram_chat_id', { mode: 'number' }),
  pushoverUserKey: varchar('pushover_user_key', { length: 100 }),
  pushoverDevice: varchar('pushover_device', { length: 100 }),
  preferencesJson: jsonb('preferences_json'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notificationEvents = pgTable(
  'notification_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    panHash: varchar('pan_hash', { length: 128 }),
    ipoId: uuid('ipo_id').references(() => ipoMaster.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    channel: varchar('channel', { length: 50 }).notNull(),
    payloadJson: jsonb('payload_json'),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_uniq_notif_event').on(table.fingerprint, table.channel),
    index('idx_notif_user').on(table.userId, table.sentAt),
  ]
);

// 12. Provider Health & Telemetry
export const providerHealth = pgTable('provider_health', {
  provider: varchar('provider', { length: 100 }).primaryKey(),
  successCount: bigint('success_count', { mode: 'number' }).default(0).notNull(),
  failureCount: bigint('failure_count', { mode: 'number' }).default(0).notNull(),
  consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
  latencyMs: integer('latency_ms').default(0).notNull(),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('HEALTHY').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 13. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }),
    details: jsonb('details'),
    ipAddress: varchar('ip_address', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_audit_time').on(table.createdAt)]
);

// 14. Watched PANs
export const watchedPans = pgTable(
  'watched_pans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    panProfileId: uuid('pan_profile_id')
      .references(() => panProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_uniq_watch').on(table.userId, table.panProfileId),
  ]
);

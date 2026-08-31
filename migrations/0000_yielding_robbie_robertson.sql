CREATE TABLE "allotment_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pan_hash" varchar(128) NOT NULL,
	"ipo_id" uuid,
	"provider" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"raw_response" jsonb,
	"duration_ms" integer NOT NULL,
	"error_code" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allotment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pan_profile_id" uuid,
	"pan_hash" varchar(128) NOT NULL,
	"ipo_id" uuid NOT NULL,
	"application_number" varchar(100),
	"status" varchar(50) NOT NULL,
	"applied_quantity" integer DEFAULT 0,
	"allotted_quantity" integer DEFAULT 0,
	"issue_price" numeric(10, 2) DEFAULT '0',
	"amount_applied" numeric(12, 2) DEFAULT '0',
	"amount_allotted" numeric(12, 2) DEFAULT '0',
	"refund_amount" numeric(12, 2) DEFAULT '0',
	"demat_credit_status" varchar(100),
	"source" varchar(100) NOT NULL,
	"confidence" varchar(20) DEFAULT 'HIGH' NOT NULL,
	"raw_reference" text,
	"fingerprint" varchar(64) NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(100),
	"details" jsonb,
	"ip_address" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_job_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bulk_job_id" varchar(50) NOT NULL,
	"pan_hash" varchar(128) NOT NULL,
	"pan_last4" varchar(4) NOT NULL,
	"label" varchar(255),
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"allotted_ipos_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bulk_jobs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"total_pans" integer NOT NULL,
	"processed_pans" integer DEFAULT 0 NOT NULL,
	"successful_pans" integer DEFAULT 0 NOT NULL,
	"partial_pans" integer DEFAULT 0 NOT NULL,
	"failed_pans" integer DEFAULT 0 NOT NULL,
	"allotted_count" integer DEFAULT 0 NOT NULL,
	"not_allotted_count" integer DEFAULT 0 NOT NULL,
	"pending_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'QUEUED' NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ipo_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"pan_profile_id" uuid NOT NULL,
	"ipo_id" uuid NOT NULL,
	"application_number" varchar(100),
	"source" varchar(100) NOT NULL,
	"bid_quantity" integer DEFAULT 0 NOT NULL,
	"bid_price" numeric(10, 2) DEFAULT '0',
	"amount" numeric(12, 2) DEFAULT '0',
	"application_status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ipo_master" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(50) NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"isin" varchar(50),
	"exchange" varchar(20) DEFAULT 'NSE' NOT NULL,
	"issue_type" varchar(50) DEFAULT 'BOOK_BUILT' NOT NULL,
	"mainboard_or_sme" varchar(20) DEFAULT 'MAINBOARD' NOT NULL,
	"status" varchar(50) DEFAULT 'UPCOMING' NOT NULL,
	"open_date" timestamp with time zone,
	"close_date" timestamp with time zone,
	"allotment_date" timestamp with time zone,
	"refund_date" timestamp with time zone,
	"demat_credit_date" timestamp with time zone,
	"listing_date" timestamp with time zone,
	"face_value" numeric(10, 2),
	"price_band_min" numeric(10, 2),
	"price_band_max" numeric(10, 2),
	"issue_price" numeric(10, 2),
	"lot_size" integer DEFAULT 1 NOT NULL,
	"minimum_application" integer DEFAULT 1 NOT NULL,
	"issue_size" numeric(15, 2),
	"registrar" varchar(100),
	"registrar_url" varchar(500),
	"subscription_qib" numeric(8, 2) DEFAULT '0',
	"subscription_nii" numeric(8, 2) DEFAULT '0',
	"subscription_retail" numeric(8, 2) DEFAULT '0',
	"subscription_employee" numeric(8, 2) DEFAULT '0',
	"subscription_total" numeric(8, 2) DEFAULT '0',
	"gmp" numeric(10, 2) DEFAULT '0',
	"gmp_percentage" numeric(6, 2) DEFAULT '0',
	"source" varchar(100) DEFAULT 'SYSTEM' NOT NULL,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ipo_master_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ipo_subscription_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ipo_id" uuid NOT NULL,
	"qib" numeric(8, 2) NOT NULL,
	"nii" numeric(8, 2) NOT NULL,
	"retail" numeric(8, 2) NOT NULL,
	"employee" numeric(8, 2) DEFAULT '0',
	"total" numeric(8, 2) NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"telegram_chat_id" bigint,
	"pushover_user_key" varchar(100),
	"pushover_device" varchar(100),
	"preferences_json" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"pan_hash" varchar(128),
	"ipo_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"channel" varchar(50) NOT NULL,
	"payload_json" jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pan_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"owner_user_id" uuid,
	"label" varchar(255),
	"pan_encrypted" text NOT NULL,
	"pan_hash" varchar(128) NOT NULL,
	"pan_last4" varchar(4) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_health" (
	"provider" varchar(100) PRIMARY KEY NOT NULL,
	"success_count" bigint DEFAULT 0 NOT NULL,
	"failure_count" bigint DEFAULT 0 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"status" varchar(50) DEFAULT 'HEALTHY' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"telegram_id" bigint NOT NULL,
	"username" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"email" varchar(255),
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"api_key_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "watched_pans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pan_profile_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allotment_checks" ADD CONSTRAINT "allotment_checks_ipo_id_ipo_master_id_fk" FOREIGN KEY ("ipo_id") REFERENCES "public"."ipo_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allotment_results" ADD CONSTRAINT "allotment_results_pan_profile_id_pan_profiles_id_fk" FOREIGN KEY ("pan_profile_id") REFERENCES "public"."pan_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allotment_results" ADD CONSTRAINT "allotment_results_ipo_id_ipo_master_id_fk" FOREIGN KEY ("ipo_id") REFERENCES "public"."ipo_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_job_items" ADD CONSTRAINT "bulk_job_items_bulk_job_id_bulk_jobs_id_fk" FOREIGN KEY ("bulk_job_id") REFERENCES "public"."bulk_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_jobs" ADD CONSTRAINT "bulk_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_pan_profile_id_pan_profiles_id_fk" FOREIGN KEY ("pan_profile_id") REFERENCES "public"."pan_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_ipo_id_ipo_master_id_fk" FOREIGN KEY ("ipo_id") REFERENCES "public"."ipo_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ipo_subscription_snapshots" ADD CONSTRAINT "ipo_subscription_snapshots_ipo_id_ipo_master_id_fk" FOREIGN KEY ("ipo_id") REFERENCES "public"."ipo_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_ipo_id_ipo_master_id_fk" FOREIGN KEY ("ipo_id") REFERENCES "public"."ipo_master"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_profiles" ADD CONSTRAINT "pan_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_profiles" ADD CONSTRAINT "pan_profiles_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_users" ADD CONSTRAINT "telegram_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched_pans" ADD CONSTRAINT "watched_pans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched_pans" ADD CONSTRAINT "watched_pans_pan_profile_id_pan_profiles_id_fk" FOREIGN KEY ("pan_profile_id") REFERENCES "public"."pan_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_checks_pan_time" ON "allotment_checks" USING btree ("pan_hash","created_at");--> statement-breakpoint
CREATE INDEX "idx_checks_provider" ON "allotment_checks" USING btree ("provider","status");--> statement-breakpoint
CREATE INDEX "idx_allot_pan_ipo" ON "allotment_results" USING btree ("pan_hash","ipo_id","checked_at");--> statement-breakpoint
CREATE INDEX "idx_allot_fingerprint" ON "allotment_results" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "idx_audit_time" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bulk_item_job" ON "bulk_job_items" USING btree ("bulk_job_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_uniq_app" ON "ipo_applications" USING btree ("pan_profile_id","ipo_id","application_number","source");--> statement-breakpoint
CREATE INDEX "idx_ipo_status" ON "ipo_master" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ipo_symbol" ON "ipo_master" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_ipo_dates" ON "ipo_master" USING btree ("open_date","close_date","allotment_date");--> statement-breakpoint
CREATE INDEX "idx_sub_ipo_time" ON "ipo_subscription_snapshots" USING btree ("ipo_id","snapshot_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_uniq_notif_event" ON "notification_events" USING btree ("fingerprint","channel");--> statement-breakpoint
CREATE INDEX "idx_notif_user" ON "notification_events" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE INDEX "idx_pan_hash" ON "pan_profiles" USING btree ("pan_hash");--> statement-breakpoint
CREATE INDEX "idx_pan_owner" ON "pan_profiles" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_tg_user_id" ON "telegram_users" USING btree ("telegram_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_uniq_watch" ON "watched_pans" USING btree ("user_id","pan_profile_id");
ALTER TABLE "allotment_results" ALTER COLUMN "applied_quantity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "allotment_results" ALTER COLUMN "allotted_quantity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "allotment_results" ALTER COLUMN "issue_price" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "allotment_results" ALTER COLUMN "amount_applied" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "allotment_results" ALTER COLUMN "amount_allotted" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "allotment_results" ALTER COLUMN "refund_amount" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "allotment_results" ALTER COLUMN "confidence" SET DEFAULT 'LOW';--> statement-breakpoint
ALTER TABLE "allotment_results" ADD COLUMN "source_type" varchar(20);--> statement-breakpoint
ALTER TABLE "allotment_results" ADD COLUMN "quality_score" varchar(20) DEFAULT 'FAILED' NOT NULL;--> statement-breakpoint
ALTER TABLE "ipo_master" ADD COLUMN "source_id" varchar(100);--> statement-breakpoint
ALTER TABLE "ipo_master" ADD COLUMN "source_url" varchar(500);
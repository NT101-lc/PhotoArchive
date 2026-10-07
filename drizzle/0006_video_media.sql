ALTER TABLE "photos" ALTER COLUMN "size_bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "kind" text DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "poster_key" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "video720_key" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "video1080_key" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "processing_error" text;--> statement-breakpoint
CREATE INDEX "photos_status_idx" ON "photos" USING btree ("status");--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_kind_valid" CHECK ("photos"."kind" in ('photo', 'video'));--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_status_valid" CHECK ("photos"."status" in ('queued', 'processing', 'ready', 'failed'));
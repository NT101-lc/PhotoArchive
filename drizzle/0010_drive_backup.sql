ALTER TABLE "photos" ADD COLUMN "drive_file_id" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "backed_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "backup_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "backup_error" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "original_key" text;
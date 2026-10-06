ALTER TABLE "members" ADD COLUMN "role" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_role_valid" CHECK ("members"."role" in (0, 1));
CREATE TABLE "photo_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_reactions" (
	"photo_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_reactions_photo_id_member_id_pk" PRIMARY KEY("photo_id","member_id"),
	CONSTRAINT "photo_reactions_emoji_valid" CHECK (emoji in ('❤️', '😂', '😮', '🔥', '👏'))
);
--> statement-breakpoint
ALTER TABLE "photo_comments" ADD CONSTRAINT "photo_comments_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_comments" ADD CONSTRAINT "photo_comments_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_reactions" ADD CONSTRAINT "photo_reactions_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_reactions" ADD CONSTRAINT "photo_reactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_comments_photo_idx" ON "photo_comments" USING btree ("photo_id","created_at");--> statement-breakpoint
CREATE INDEX "photo_comments_created_idx" ON "photo_comments" USING btree ("created_at");
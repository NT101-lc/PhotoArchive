ALTER TABLE "albums" ADD COLUMN "places" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Album có từ trước: một nơi = location hiện tại (kèm toạ độ nếu đã chọn từ gợi ý)
UPDATE "albums" SET "places" = jsonb_build_array(jsonb_build_object('name', "location", 'lat', "latitude", 'lng', "longitude")) WHERE "places" = '[]'::jsonb;

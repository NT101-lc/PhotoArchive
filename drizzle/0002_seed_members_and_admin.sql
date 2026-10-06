-- Thành viên thật của nhóm: Nam Anh, Thảo, Diệp, Hoàng, Nam, Hưng (role 1) + ADMIN (role 0).
-- Đổi tên các thành viên mẫu cũ thay vì xoá, để ảnh họ đã upload vẫn giữ người upload.
UPDATE "members" SET "name" = 'Diệp', "updated_at" = now() WHERE "name" = 'Minh' AND NOT EXISTS (SELECT 1 FROM "members" WHERE "name" = 'Diệp');--> statement-breakpoint
UPDATE "members" SET "name" = 'Hoàng', "updated_at" = now() WHERE "name" = 'Huy' AND NOT EXISTS (SELECT 1 FROM "members" WHERE "name" = 'Hoàng');--> statement-breakpoint
UPDATE "members" SET "name" = 'Nam', "updated_at" = now() WHERE "name" = 'Linh' AND NOT EXISTS (SELECT 1 FROM "members" WHERE "name" = 'Nam');--> statement-breakpoint
UPDATE "members" SET "name" = 'Hưng', "updated_at" = now() WHERE "name" = 'Quân' AND NOT EXISTS (SELECT 1 FROM "members" WHERE "name" = 'Hưng');--> statement-breakpoint
INSERT INTO "members" ("name", "role") VALUES
  ('Nam Anh', 1), ('Thảo', 1), ('Diệp', 1), ('Hoàng', 1), ('Nam', 1), ('Hưng', 1)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
-- Tài khoản admin; đặt mật khẩu bằng: npm run admin:password
INSERT INTO "members" ("name", "role") VALUES ('ADMIN', 0)
ON CONFLICT ("name") DO UPDATE SET "role" = 0;

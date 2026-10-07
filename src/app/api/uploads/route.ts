import { handle, json, readJson } from "@/lib/api";
import { requireMember } from "@/lib/auth";
import { MAX_FILES_PER_REQUEST, MAX_UPLOAD_BYTES, presignInput, presignPhotoUploads } from "@/lib/mutations";
import { isStorageConfigured } from "@/lib/storage";

/** GET /api/uploads — upload đã dùng được chưa (R2 đã cấu hình đủ chưa). */
export const GET = handle(async () =>
  json({ configured: isStorageConfigured(), maxBytes: MAX_UPLOAD_BYTES, maxFilesPerRequest: MAX_FILES_PER_REQUEST }),
);

/**
 * POST /api/uploads — cấp URL đã ký để upload thẳng lên R2.
 * Body: { albumSlug, files: [{ name, type, size }] }
 * → { uploads: [{ name, key, contentType, uploadUrl } (ảnh) hoặc { ..., multipart: { uploadId, partSize, partCount } } (video)] }
 */
export const POST = handle(async (req: Request) => {
  const actor = await requireMember();
  const input = await readJson(req, presignInput);
  return json({ uploads: await presignPhotoUploads(actor, input) });
});

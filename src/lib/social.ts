import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { albums, db, members, photoComments, photoReactions, photos } from "@/db";
import { ForbiddenError } from "./auth";
import { BadRequestError, NotFoundError } from "./mutations";
import { canComment, canDeleteComment, type Actor } from "./permissions";
import { cleanComment, MAX_COMMENT_LENGTH, REACTIONS, summarizeReactions, type ReactionSummary } from "./photo-social";
import { resolveObjectUrl } from "./storage";

// Bình luận & cảm xúc trên từng ảnh. Lightbox hỏi theo từng ảnh khi mở; lưới ảnh chỉ cần số đếm (getSocialCounts).

export type PhotoComment = {
  id: string;
  body: string;
  author: string;
  authorId: string | null;
  avatarUrl: string | null;
  createdAt: string;
  canDelete: boolean;
};

export type PhotoSocial = { comments: PhotoComment[]; reactions: ReactionSummary[] };

async function requirePhoto(photoId: string) {
  const [p] = await db.select({ id: photos.id }).from(photos).where(eq(photos.id, photoId)).limit(1);
  if (!p) throw new NotFoundError("Photo not found.");
}

export async function getPhotoSocial(photoId: string, me: Actor | null): Promise<PhotoSocial> {
  const [comments, reactions] = await Promise.all([
    db
      .select({
        id: photoComments.id,
        body: photoComments.body,
        authorId: photoComments.authorId,
        createdAt: photoComments.createdAt,
        author: members.name,
        avatarKey: members.avatarKey,
      })
      .from(photoComments)
      .leftJoin(members, eq(members.id, photoComments.authorId))
      .where(eq(photoComments.photoId, photoId))
      .orderBy(asc(photoComments.createdAt)),
    db
      .select({ emoji: photoReactions.emoji, memberId: photoReactions.memberId, name: members.name })
      .from(photoReactions)
      .leftJoin(members, eq(members.id, photoReactions.memberId))
      .where(eq(photoReactions.photoId, photoId))
      .orderBy(asc(photoReactions.createdAt)),
  ]);

  return {
    comments: await Promise.all(
      comments.map(async ({ avatarKey, author, createdAt, ...c }) => ({
        ...c,
        author: author ?? "Someone",
        avatarUrl: await resolveObjectUrl(avatarKey),
        createdAt: createdAt.toISOString(),
        canDelete: canDeleteComment(me, c),
      })),
    ),
    reactions: summarizeReactions(reactions, me?.id ?? null),
  };
}

/** Số bình luận / cảm xúc của nhiều ảnh (cho các ô trong lưới), 2 truy vấn cho cả album. */
export async function getSocialCounts(photoIds: string[]) {
  const counts = new Map<string, { comments: number; reactions: number }>();
  if (photoIds.length === 0) return counts;
  const [c, r] = await Promise.all([
    db
      .select({ id: photoComments.photoId, n: sql<number>`count(*)::int` })
      .from(photoComments)
      .where(inArray(photoComments.photoId, photoIds))
      .groupBy(photoComments.photoId),
    db
      .select({ id: photoReactions.photoId, n: sql<number>`count(*)::int` })
      .from(photoReactions)
      .where(inArray(photoReactions.photoId, photoIds))
      .groupBy(photoReactions.photoId),
  ]);
  for (const { id, n } of c) counts.set(id, { comments: n, reactions: 0 });
  for (const { id, n } of r) counts.set(id, { comments: counts.get(id)?.comments ?? 0, reactions: n });
  return counts;
}

export const addCommentInput = z.object({ body: z.string().max(MAX_COMMENT_LENGTH * 2) });

export async function addComment(actor: Actor, photoId: string, input: z.infer<typeof addCommentInput>) {
  if (!canComment(actor)) throw new ForbiddenError("Choose who you are first.");
  const body = cleanComment(input.body);
  if (!body) throw new BadRequestError("Write something first.");
  await requirePhoto(photoId);
  await db.insert(photoComments).values({ photoId, authorId: actor.id, body });
  return getPhotoSocial(photoId, actor);
}

export async function deleteComment(actor: Actor, commentId: string) {
  const [c] = await db
    .select({ photoId: photoComments.photoId, authorId: photoComments.authorId })
    .from(photoComments)
    .where(eq(photoComments.id, commentId))
    .limit(1);
  if (!c) throw new NotFoundError("Comment not found.");
  if (!canDeleteComment(actor, c)) throw new ForbiddenError("You can only delete your own comments.");
  await db.delete(photoComments).where(eq(photoComments.id, commentId));
  return getPhotoSocial(c.photoId, actor);
}

export const setReactionInput = z.object({ emoji: z.enum(REACTIONS).nullable() });

/** Thả / đổi / bỏ cảm xúc của người đang dùng. */
export async function setReaction(actor: Actor, photoId: string, input: z.infer<typeof setReactionInput>) {
  if (!canComment(actor)) throw new ForbiddenError("Choose who you are first.");
  await requirePhoto(photoId);
  if (input.emoji === null) {
    await db.delete(photoReactions).where(and(eq(photoReactions.photoId, photoId), eq(photoReactions.memberId, actor.id)));
  } else {
    await db
      .insert(photoReactions)
      .values({ photoId, memberId: actor.id, emoji: input.emoji })
      .onConflictDoUpdate({
        target: [photoReactions.photoId, photoReactions.memberId],
        set: { emoji: input.emoji, createdAt: new Date() },
      });
  }
  return getPhotoSocial(photoId, actor);
}

/** Bình luận gần đây nhất (cho "Recent activity" ở dashboard). */
export async function getRecentComments(limit = 8) {
  const rows = await db
    .select({
      id: photoComments.id,
      body: photoComments.body,
      at: photoComments.createdAt,
      name: members.name,
      avatarKey: members.avatarKey,
      photoId: photoComments.photoId,
      albumSlug: albums.slug,
      albumTitle: albums.title,
    })
    .from(photoComments)
    .innerJoin(photos, eq(photos.id, photoComments.photoId))
    .innerJoin(albums, eq(albums.id, photos.albumId))
    .leftJoin(members, eq(members.id, photoComments.authorId))
    .orderBy(desc(photoComments.createdAt))
    .limit(limit);
  return Promise.all(
    rows.map(async ({ avatarKey, at, name, ...r }) => ({
      ...r,
      name: name ?? "Someone",
      at: at.toISOString(),
      avatarUrl: await resolveObjectUrl(avatarKey),
    })),
  );
}

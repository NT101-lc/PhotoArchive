"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { addPhotoComment, deletePhotoComment, getPhotoSocial, setPhotoReaction } from "@/lib/api-client";
import { plural, timeAgo } from "@/lib/format";
import { MAX_COMMENT_LENGTH, REACTIONS, type Reaction } from "@/lib/photo-social";
import type { PhotoSocial } from "@/lib/social";
import { Avatar } from "./Avatar";
import { IconClose, IconComment, IconHeart, IconTrash } from "./Icons";
import { useToast } from "./Toast";

export type SocialCounts = { commentCount: number; reactionCount: number };

const countsOf = (s: PhotoSocial): SocialCounts => ({
  commentCount: s.comments.length,
  reactionCount: s.reactions.reduce((n, r) => n + r.count, 0),
});

/**
 * Bình luận + cảm xúc của ảnh đang xem trong lightbox. Tải lại mỗi khi đổi ảnh;
 * mỗi lần ghi, server trả về bản mới nhất và báo số đếm cho lưới ảnh (`onCounts`).
 */
export function usePhotoSocial(photoId: string, onCounts?: (photoId: string, counts: SocialCounts) => void) {
  const toast = useToast();
  const [data, setData] = useState<{ photoId: string; social: PhotoSocial } | null>(null);
  const onCountsRef = useRef(onCounts);
  useEffect(() => {
    onCountsRef.current = onCounts;
  }, [onCounts]);

  useEffect(() => {
    if (!photoId) return;
    let alive = true;
    getPhotoSocial<PhotoSocial>(photoId)
      .then((social) => alive && setData({ photoId, social }))
      .catch(() => alive && setData({ photoId, social: { comments: [], reactions: [] } }));
    return () => {
      alive = false;
    };
  }, [photoId]);

  const apply = useCallback(
    (social: PhotoSocial) => {
      setData({ photoId, social });
      onCountsRef.current?.(photoId, countsOf(social));
    },
    [photoId],
  );

  const fail = useCallback(
    (title: string, err: unknown) => toast.show({ tone: "warn", title, message: (err as Error).message }),
    [toast],
  );

  // Dữ liệu còn của ảnh trước (đang tải ảnh mới) thì coi như chưa có
  const social = data?.photoId === photoId ? data.social : null;

  return {
    social,
    react: async (emoji: Reaction) => {
      const mine = social?.reactions.find((r) => r.mine)?.emoji;
      try {
        apply(await setPhotoReaction<PhotoSocial>(photoId, mine === emoji ? null : emoji));
      } catch (err) {
        fail("Couldn’t save your reaction", err);
      }
    },
    comment: async (body: string) => {
      try {
        apply(await addPhotoComment<PhotoSocial>(photoId, body));
        return true;
      } catch (err) {
        fail("Couldn’t post the comment", err);
        return false;
      }
    },
    remove: async (commentId: string) => {
      try {
        apply(await deletePhotoComment<PhotoSocial>(commentId));
      } catch (err) {
        fail("Couldn’t delete the comment", err);
      }
    },
  };
}

/** Huy hiệu trên ô ảnh: "💬 3  ❤ 5". Bấm để mở ảnh với bảng bình luận. Không có gì thì không hiện. */
export function SocialBadge({
  commentCount,
  reactionCount,
  onClick,
  className = "",
}: SocialCounts & { onClick?: () => void; className?: string }) {
  if (!commentCount && !reactionCount) return null;
  const label = [commentCount && plural(commentCount, "comment"), reactionCount && plural(reactionCount, "reaction")]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}. Open comments`}
      title={label}
      className={`flex items-center gap-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white tabular-nums backdrop-blur-sm hover:bg-black/75 ${className}`}
    >
      {commentCount > 0 && (
        <span className="flex items-center gap-1">
          <IconComment size={12} />
          {commentCount}
        </span>
      )}
      {reactionCount > 0 && (
        <span className="flex items-center gap-1">
          <IconHeart size={12} filled />
          {reactionCount}
        </span>
      )}
    </button>
  );
}

/** Hàng cảm xúc dưới ảnh: 5 emoji, số người đã thả, cái của mình được tô sáng. Bấm lại để bỏ. */
export function ReactionBar({
  social,
  canReact,
  onReact,
}: {
  social: PhotoSocial | null;
  canReact: boolean;
  onReact: (emoji: Reaction) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Reactions">
      {REACTIONS.map((emoji) => {
        const r = social?.reactions.find((x) => x.emoji === emoji);
        const names = r?.names.join(", ");
        return (
          <button
            key={emoji}
            type="button"
            disabled={!canReact || !social}
            onClick={() => onReact(emoji)}
            aria-pressed={!!r?.mine}
            aria-label={`${emoji}${r ? `, ${r.count}: ${names}` : ""}`}
            title={names || (canReact ? "React" : "Pick your name to react")}
            className={`flex h-8 items-center gap-1 rounded-full border px-2 text-sm transition-colors disabled:cursor-default ${
              r?.mine
                ? "border-[#6cc79c] bg-[#6cc79c]/20"
                : r
                  ? "border-white/20 bg-white/5 hover:bg-white/10"
                  : "border-transparent opacity-55 hover:bg-white/10 hover:opacity-100"
            }`}
          >
            <span className="leading-none">{emoji}</span>
            {r && <span className="text-xs font-semibold tabular-nums">{r.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Bảng bình luận: bên phải trên desktop, trượt từ dưới lên trên mobile. Enter để gửi, Shift+Enter xuống dòng. */
export function CommentsPanel({
  social,
  canComment,
  onSend,
  onDelete,
  onClose,
}: {
  social: PhotoSocial | null;
  canComment: boolean;
  onSend: (body: string) => Promise<boolean>;
  onDelete: (commentId: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const comments = social?.comments ?? [];

  // Có bình luận mới → cuộn xuống cuối
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    if (await onSend(body)) setDraft("");
    setSending(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  }

  return (
    <aside
      className="animate-rise absolute inset-x-2 bottom-2 z-10 flex max-h-[70%] flex-col rounded-2xl border border-white/15 bg-[#171c1b]/95 shadow-2xl backdrop-blur-md sm:inset-x-auto sm:top-2 sm:right-4 sm:bottom-2 sm:max-h-none sm:w-[340px]"
      aria-label="Comments"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold">
          Comments <span className="text-[#97a29e] tabular-nums">{comments.length}</span>
        </span>
        <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-white/10" aria-label="Close comments">
          <IconClose size={14} />
        </button>
      </div>

      <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {!social && <li className="text-sm text-[#97a29e]">Loading…</li>}
        {social && comments.length === 0 && (
          <li className="text-sm text-[#97a29e]">No comments yet. Say something about this one.</li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="group flex gap-2.5">
            <Avatar name={c.author} url={c.avatarUrl} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{c.author}</span>
                <time dateTime={c.createdAt} className="text-xs text-[#97a29e]">
                  {timeAgo(c.createdAt)}
                </time>
                {c.canDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    className="ml-auto rounded p-0.5 text-[#97a29e] opacity-0 group-hover:opacity-100 hover:text-[#f0907c] focus-visible:opacity-100 max-sm:opacity-100"
                    aria-label="Delete comment"
                    title="Delete comment"
                  >
                    <IconTrash size={13} />
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-line">{c.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="shrink-0 border-t border-white/10 p-3">
        {canComment ? (
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none [field-sizing:content] placeholder:text-[#97a29e] focus:border-[#6cc79c]"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim() || sending}
              className="h-10 shrink-0 rounded-xl bg-[#6cc79c] px-3.5 text-sm font-semibold text-[#0b1a14] disabled:opacity-40"
            >
              Post
            </button>
          </div>
        ) : (
          <p className="text-sm text-[#97a29e]">Pick your name to comment.</p>
        )}
      </div>
    </aside>
  );
}

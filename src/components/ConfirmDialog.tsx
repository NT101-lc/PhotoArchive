"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";

/** Hộp xác nhận cho thao tác không hoàn tác được (xoá album / ảnh). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      eyebrow="Can’t be undone"
      title={title}
      maxWidth="max-w-[440px]"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="p-5 text-[0.95rem] text-ink-soft">{children}</div>
    </Modal>
  );
}

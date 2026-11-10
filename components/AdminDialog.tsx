"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function AdminDialog({
  open,
  title,
  description,
  onClose,
  wide = false,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>("input, select, textarea, [contenteditable='true'], button")?.focus();
      });
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`admin-dialog${wide ? " admin-dialog--wide" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="admin-dialog-card">
        <header className="admin-dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            className="admin-dialog-close"
            type="button"
            aria-label="Закрыть панель"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="admin-dialog-body">{children}</div>
      </div>
    </dialog>
  );
}

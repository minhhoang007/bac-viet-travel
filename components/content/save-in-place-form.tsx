"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

type Saved = { result: string; revision?: number };

/**
 * An editor form that saves without leaving the page: no reload, no jump to the top, no new history entry, and on a
 * conflict or an error the text being written stays in the fields. The action returns the new revision, written into
 * the form's `revision` field so the next save is checked against it; the rest of the page (status, versions, what
 * is missing) refreshes around the form. Leaving with unsaved changes asks first; Ctrl/⌘+S saves.
 */
export function SaveInPlaceForm({
  action,
  messages,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<Saved>;
  /** Text per result ("saved", "conflict"…); `failed` for anything else. */
  messages: Record<string, string> & { saved: string; failed: string };
  className?: string;
  children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ result: string; at: number } | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        form.current?.requestSubmit();
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("keydown", shortcut);
    };
  }, []);

  const save = () => {
    const el = form.current;
    if (!el || pending) return;
    const data = new FormData(el);
    setStatus(null); // the last save's message is not this one's
    startTransition(async () => {
      let saved: Saved;
      try {
        saved = await action(data);
      } catch {
        saved = { result: "failed" };
      }
      if (saved.result === "saved" && saved.revision !== undefined) {
        const field = el.elements.namedItem("revision");
        if (field instanceof HTMLInputElement) field.value = String(saved.revision);
        dirty.current = false;
        router.refresh();
      }
      setStatus({ result: saved.result, at: Date.now() });
    });
  };

  const ok = status?.result === "saved";
  return (
    <form
      ref={form}
      className={className}
      aria-busy={pending || undefined}
      data-saving={pending || undefined}
      onInput={() => {
        dirty.current = true;
      }}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {children}
      <p
        role={ok ? "status" : "alert"}
        key={status?.at}
        className={
          status
            ? `fixed right-4 bottom-4 z-50 max-w-sm rounded-md border p-3 text-sm shadow-lg ${ok ? "border-success/40 bg-background" : "border-danger/50 bg-background text-danger"}`
            : "sr-only"
        }
        data-testid="save-result"
      >
        {status ? (messages[status.result] ?? messages.failed) : ""}
      </p>
    </form>
  );
}

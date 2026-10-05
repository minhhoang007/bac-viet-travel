"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

type Signed = { ok: true; id: string; url: string; fields: Record<string, string> } | { ok: false };
type Confirmed = { ok: true } | { ok: false; error: "format" | "size" | "failed" };

export interface MediaUploaderProps {
  label: string;
  uploadingLabel: string;
  /** File extensions accepted, e.g. ["jpg", "png", "webp"]. */
  formats: readonly string[];
  maxBytes: number;
  errors: { format: string; size: string; failed: string };
  requestUpload: (name: string) => Promise<Signed>;
  confirmUpload: (id: string) => Promise<Confirmed>;
}

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };
const noopSubscribe = () => () => {};

/** Several images at once: sign on the server, post straight to the media provider, confirm on the server. */
export function MediaUploader({ label, uploadingLabel, formats, maxBytes, errors, requestUpload, confirmUpload }: MediaUploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  // Disabled in the server HTML: a file picked before hydration would be dropped (no onChange yet).
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const accept = formats.map((f) => MIME[f]).filter(Boolean);

  async function uploadOne(file: File): Promise<string | null> {
    if (!accept.includes(file.type)) return `${file.name}: ${errors.format}`;
    if (file.size > maxBytes) return `${file.name}: ${errors.size}`;
    const signed = await requestUpload(file.name);
    if (!signed.ok) return `${file.name}: ${errors.failed}`;
    const body = new FormData();
    for (const [k, v] of Object.entries(signed.fields)) body.append(k, v);
    body.append("file", file);
    const sent = await fetch(signed.url, { method: "POST", body }).catch(() => null);
    const confirmed = await confirmUpload(signed.id);
    if (confirmed.ok) return null;
    return `${file.name}: ${errors[sent?.ok ? confirmed.error : "failed"]}`;
  }

  async function upload(files: File[]) {
    setBusy(true);
    setProblems([]);
    const results = await Promise.all(files.map((f) => uploadOne(f).catch(() => `${f.name}: ${errors.failed}`)));
    setProblems(results.filter((r): r is string => r !== null));
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <label className="inline-flex h-10 w-fit cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground has-[:disabled]:opacity-60">
        {busy ? uploadingLabel : label}
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          accept={accept.join(",")}
          disabled={busy || !hydrated}
          data-testid="media-upload"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void upload(files);
          }}
        />
      </label>
      {problems.length > 0 && (
        <ul role="alert" className="text-sm text-red-700">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

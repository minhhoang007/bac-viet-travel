"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UploadError = "type" | "size" | "quota" | "failed";

export interface UploaderProps {
  label: string;
  uploadingLabel: string;
  accept: string[];
  maxBytes: number;
  errors: Record<UploadError, string>;
  /** Server actions (passed in by the page). */
  requestUpload(input: { name: string; contentType: string; size: number }): Promise<{ ok: true; fileId: string; url: string; headers: Record<string, string> } | { ok: false; error: UploadError }>;
  confirmUpload(fileId: string): Promise<{ ok: boolean }>;
}

/** Validate → reserve (server) → PUT straight to object storage → confirm (server). */
export function Uploader({ label, uploadingLabel, accept, maxBytes, errors, requestUpload, confirmUpload }: UploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!accept.includes(file.type)) return setError("type");
    if (file.size > maxBytes) return setError("size");
    setBusy(true);
    try {
      const reserved = await requestUpload({ name: file.name, contentType: file.type, size: file.size });
      if (!reserved.ok) return setError(reserved.error);
      const put = await fetch(reserved.url, { method: "PUT", headers: reserved.headers, body: file });
      const confirmed = put.ok ? await confirmUpload(reserved.fileId) : { ok: false };
      if (!confirmed.ok) return setError("failed");
      router.refresh();
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <label className="inline-flex h-10 w-fit cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground has-[:disabled]:opacity-60">
        {busy ? uploadingLabel : label}
        <input
          ref={input}
          type="file"
          className="sr-only"
          accept={accept.join(",")}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {errors[error]}
        </p>
      )}
    </div>
  );
}

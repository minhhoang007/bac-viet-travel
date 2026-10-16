"use client";
// Share a post: the phone's own share sheet (Zalo, Messenger… whatever the guest has), Facebook, or copy the link.
// Zalo's own share button needs an Official Account and its SDK; the share sheet reaches the Zalo app without one.
import { Check, Link2, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};
type TagWindow = Window & { gtag?: (...args: unknown[]) => void };

export function PostShare({ url, title, t }: { url: string; title: string; t: { label: string; share: string; facebook: string; copy: string; copied: string } }) {
  // The share sheet exists in the browser only (phones, some desktops): false while rendering on the server.
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const [copied, setCopied] = useState(false);
  const track = (method: string) => (window as TagWindow).gtag?.("event", "share", { method, content_type: "article", item_id: url });
  const button = "inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted";

  return (
    <div className="mt-10 flex flex-wrap items-center gap-2" data-testid="post-share">
      <span className="mr-1 text-sm text-muted-foreground">{t.label}</span>
      {canShare && (
        <button
          type="button"
          className={button}
          onClick={() => {
            track("native");
            navigator.share({ title, url }).catch(() => {});
          }}
        >
          <Share2 className="size-4" aria-hidden="true" />
          {t.share}
        </button>
      )}
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={button}
        onClick={() => track("facebook")}
      >
        {t.facebook}
      </a>
      <button
        type="button"
        className={button}
        onClick={() => {
          track("copy");
          navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {});
        }}
      >
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? t.copied : t.copy}</span>
      </button>
    </div>
  );
}

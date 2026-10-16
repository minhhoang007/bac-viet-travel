"use client";

// One image picker for the admin: the media library, an upload, or a free Unsplash photo (hotlinked and credited, see
// product/media/unsplash.ts). Keeps the choice in hidden form fields: `${name}`, `${name}CreditName`, `${name}CreditUrl`.
import { useState, useTransition, type ReactNode } from "react";
import { ImageIcon } from "lucide-react";
import { pickUnsplash, searchUnsplash } from "@/app/actions/unsplash";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/components/ui/cn";
import type { UnsplashResult } from "@/product/media/unsplash";

export type PickerImage = { src: string; credit?: { name: string; url: string } };
export type LibraryItem = { id: string; thumb: string; src: string; name: string };

export interface ImagePickerText {
  choose: string;
  change: string;
  remove: string;
  title: string;
  description: string;
  tabs: { library: string; upload: string; unsplash: string };
  libraryEmpty: string;
  search: string;
  searchButton: string;
  searching: string;
  noResults: string;
  unavailable: string;
  use: string;
  /** "{name}" is replaced by the photographer. */
  credit: string;
}

type Tab = "library" | "upload" | "unsplash";

export function ImagePicker(props: {
  name: string;
  label: string;
  initial?: PickerImage;
  library?: LibraryItem[];
  uploader?: ReactNode;
  unsplash: boolean;
  t: ImagePickerText;
}) {
  const { t } = props;
  const [value, setValue] = useState<PickerImage | undefined>(props.initial);
  const [open, setOpen] = useState(false);
  const tabs: Tab[] = [...(props.library ? (["library", "upload"] as const) : []), ...(props.unsplash ? (["unsplash"] as const) : [])];
  const [tab, setTab] = useState<Tab>(tabs[0] ?? "library");
  const choose = (image: PickerImage) => (setValue(image), setOpen(false));

  return (
    <div className="grid gap-2" data-testid={`picker-${props.name}`}>
      <span className="text-sm font-medium">{props.label}</span>
      <input type="hidden" name={props.name} value={value?.src ?? ""} />
      <input type="hidden" name={`${props.name}CreditName`} value={value?.credit?.name ?? ""} />
      <input type="hidden" name={`${props.name}CreditUrl`} value={value?.credit?.url ?? ""} />
      {value?.src ? (
        <figure className="grid gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a library, site or Unsplash image */}
          <img src={value.src} alt="" className="aspect-[16/9] w-full max-w-md rounded-md border border-border object-cover" />
          {value.credit && <figcaption className="text-xs text-muted-foreground">{t.credit.replace("{name}", value.credit.name)}</figcaption>}
        </figure>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {tabs.length > 0 && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                <ImageIcon className="size-4" aria-hidden="true" />
                {value?.src ? t.change : t.choose}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t.title}</DialogTitle>
                <DialogDescription>{t.description}</DialogDescription>
              </DialogHeader>
              <div role="tablist" className="flex flex-wrap gap-2">
                {tabs.map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-full border px-3 py-1 text-sm", tab === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                    {t.tabs[k]}
                  </button>
                ))}
              </div>
              <div role="tabpanel">
                {tab === "library" && <LibraryGrid items={props.library ?? []} empty={t.libraryEmpty} onPick={(i) => choose({ src: i.src })} />}
                {tab === "upload" && (
                  <div className="grid gap-3">
                    {props.uploader}
                    <LibraryGrid items={props.library ?? []} empty={t.libraryEmpty} onPick={(i) => choose({ src: i.src })} />
                  </div>
                )}
                {tab === "unsplash" && <UnsplashPanel t={t} onPick={choose} />}
              </div>
            </DialogContent>
          </Dialog>
        )}
        {value?.src && (
          <Button type="button" variant="ghost" onClick={() => setValue(undefined)}>
            {t.remove}
          </Button>
        )}
      </div>
    </div>
  );
}

function LibraryGrid({ items, empty, onPick }: { items: LibraryItem[]; empty: string; onPick: (i: LibraryItem) => void }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <li key={i.id}>
          <button type="button" onClick={() => onPick(i)} aria-label={i.name} className="block w-full overflow-hidden rounded-md border border-border hover:border-primary focus-visible:ring-2 focus-visible:ring-primary">
            {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail resized by the media CDN */}
            <img src={i.thumb} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function UnsplashPanel({ t, onPick }: { t: ImagePickerText; onPick: (image: PickerImage) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnsplashResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const search = () =>
    start(async () => {
      const r = await searchUnsplash(query);
      setFailed(!r.ok);
      setResults(r.ok ? r.results : null);
    });
  const use = (id: string) =>
    start(async () => {
      const r = await pickUnsplash(id);
      if (r.ok) onPick({ src: r.src, credit: r.credit });
      else setFailed(true);
    });

  return (
    <div className="grid gap-3" data-testid="unsplash-panel">
      {/* No <form>: this panel sits inside the tour form (a nested form is dropped by the browser and its button
          would submit the tour). Enter searches instead of submitting. */}
      <div role="search" className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (query.trim().length >= 2) search();
          }}
          placeholder={t.search}
          aria-label={t.search}
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <Button type="button" onClick={search} disabled={pending || query.trim().length < 2}>
          {pending ? t.searching : t.searchButton}
        </Button>
      </div>
      {failed && <p className="text-sm text-danger">{t.unavailable}</p>}
      {results && results.length === 0 && <p className="text-sm text-muted-foreground">{t.noResults}</p>}
      {results && results.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {results.map((r) => (
            <li key={r.id} className="grid gap-1">
              <button type="button" disabled={pending} onClick={() => use(r.id)} aria-label={`${t.use}: ${r.alt || r.author}`} className="block overflow-hidden rounded-md border border-border hover:border-primary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
                {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash thumbnail, hotlinked as its API terms require */}
                <img src={r.thumb} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              </button>
              <span className="truncate text-xs text-muted-foreground">{t.credit.replace("{name}", r.author)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

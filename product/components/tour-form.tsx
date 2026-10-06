"use client";

import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveTour } from "@/app/actions/tours";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { cn } from "@/components/ui/cn";
import type { Locale } from "@/config/app";
import { getProductContent } from "../content";
import { DESTINATIONS } from "../tours/model";
import { getTourAdminContent, tourProblemLabel } from "../tours/admin-content";
import { tourProblems, type TourDraft } from "../tours/document";

const TABS = ["general", "vi", "en", "seo", "images", "private"] as const;
type Tab = (typeof TABS)[number];
type Section = "shared" | "vi" | "en";
type Obj = Record<string, unknown>;

// Library images are stored by id, static files by path.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noopSubscribe = () => () => {};
const input = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm";
const area = "w-full rounded-md border border-border bg-background p-3 text-sm";

/** Admin form for one tour draft (content module). Incomplete drafts save; the problems list shows what blocks submitting. */
export function TourForm({
  locale,
  item,
  images,
  initialTab,
}: {
  locale: Locale;
  item: { id: string; revision: number; slug: string; draft: TourDraft; slugLocked: boolean };
  /** Static images available under public/ (until the media library is on). */
  images: string[];
  initialTab: Tab;
}) {
  const c = getTourAdminContent(locale);
  const destinations = getProductContent(locale).destinations;
  const [data, setData] = useState<TourDraft>(item.draft);
  const [slug, setSlug] = useState(item.slug);
  const [tab, setTab] = useState<Tab>(initialTab);
  const problems = useMemo(() => tourProblems(data), [data]);
  const ids = useId();
  // Tabs and lists only work once React runs; tests and the save button wait for it.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const section = (s: Section) => (data[s] ?? {}) as Obj;
  const set = (s: Section, key: string, value: unknown) => setData((d) => ({ ...d, [s]: { ...(d[s] as Obj), [key]: value } }));
  const text = (s: Section, key: string) => (typeof section(s)[key] === "string" ? (section(s)[key] as string) : "");
  const num = (s: Section, key: string) => (typeof section(s)[key] === "number" ? String(section(s)[key]) : "");
  const toNum = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const price = (section("shared").price ?? {}) as { vnd?: number; usd?: number };
  const pricing = (section("shared").pricing ?? {}) as { childPercent?: number; infantVnd?: number; singleSupplementVnd?: number };
  // An all-empty pricing block is left out (the tour then uses the defaults).
  const setPricing = (patch: Partial<typeof pricing>) => {
    const next = { ...pricing, ...patch };
    set("shared", "pricing", Object.values(next).some((v) => v !== undefined) ? next : undefined);
  };
  const priv = section("shared").private as { maxGuests?: number; tiers?: { minGuests?: number; vnd?: number; usd?: number }[] } | undefined;

  const tabLabel: Record<Tab, string> = c.tabs;
  const tabHasProblem = (t: Tab) =>
    problems.some((p) => (t === "seo" ? /^(vi|en).seo/.test(p) : t === "vi" || t === "en" ? p.startsWith(`${t}.`) && !p.startsWith(`${t}.seo`) : t === "images" ? p.startsWith("shared.images") : t === "private" ? p.startsWith("shared.private") : p.startsWith("shared.") && !/^shared\.(images|private)/.test(p)));
  const problemLabel = (path: string) => tourProblemLabel(path, c);

  const textField = (s: Section, key: keyof typeof c.fields, multiline = false, hint?: string) => (
    <Field label={c.fields[key]} hint={hint}>
      {(id, describedBy) =>
        multiline ? (
          <textarea id={id} aria-describedby={describedBy} rows={key === "body" ? 10 : 3} className={area} value={text(s, key)} onChange={(e) => set(s, key, e.target.value)} />
        ) : (
          <input id={id} aria-describedby={describedBy} className={input} value={text(s, key)} onChange={(e) => set(s, key, e.target.value)} />
        )
      }
    </Field>
  );

  const textPanel = (s: "vi" | "en") => (
    <div className="grid gap-4">
      {textField(s, "title")}
      {textField(s, "summary", true)}
      <div className="grid gap-4 sm:grid-cols-2">
        {textField(s, "departure")}
        {textField(s, "groupSize")}
      </div>
      <StringList label={c.fields.highlights} values={(section(s).highlights as string[]) ?? []} onChange={(v) => set(s, "highlights", v)} c={c} />
      <ItineraryList values={(section(s).itinerary as { title: string; description: string }[]) ?? []} onChange={(v) => set(s, "itinerary", v)} c={c} />
      <StringList label={c.fields.includes} values={(section(s).includes as string[]) ?? []} onChange={(v) => set(s, "includes", v)} c={c} />
      <StringList label={c.fields.excludes} values={(section(s).excludes as string[]) ?? []} onChange={(v) => set(s, "excludes", v)} c={c} />
      {textField(s, "body", true, c.fields.bodyHint)}
    </div>
  );

  return (
    <form action={saveTour} className="grid gap-5" data-hydrated={hydrated || undefined}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="revision" value={item.revision} />
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <Field label={c.create.slug} hint={item.slugLocked ? c.slugLocked : c.create.slugHint}>
        {(id, describedBy) => (
          <input id={id} name="slug" aria-describedby={describedBy} className={input} value={slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        )}
      </Field>

      {problems.length > 0 && (
        <Notice tone="warning" role="note" title={c.problemsTitle} data-testid="tour-problems">
          <ul className="list-disc pl-5">
            {problems.slice(0, 12).map((p) => (
              <li key={p}>{problemLabel(p)}</li>
            ))}
            {problems.length > 12 && <li>…</li>}
          </ul>
        </Notice>
      )}

      <div role="tablist" aria-label={c.title} className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${ids}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${ids}-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              const i = TABS.indexOf(t);
              const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i - 1 + TABS.length) % TABS.length] : undefined;
              if (next) {
                setTab(next);
                document.getElementById(`${ids}-tab-${next}`)?.focus();
              }
            }}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm", tab === t ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {tabLabel[t]}
            {tabHasProblem(t) && <span className="ml-1.5 inline-block size-2 rounded-full bg-warning align-middle" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <Panel id={`${ids}-panel-general`} labelledBy={`${ids}-tab-general`} hidden={tab !== "general"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={c.fields.destination}>
            {(id) => (
              <select id={id} className={input} value={text("shared", "destination")} onChange={(e) => set("shared", "destination", e.target.value || undefined)}>
                <option value="">—</option>
                {DESTINATIONS.map((d) => (
                  <option key={d} value={d}>
                    {destinations[d].name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={c.fields.order}>
            {(id) => <input id={id} type="number" min={0} max={1000} className={input} value={num("shared", "order")} onChange={(e) => set("shared", "order", toNum(e.target.value))} />}
          </Field>
          <Field label={c.fields.days}>
            {(id) => <input id={id} type="number" min={1} max={30} className={input} value={num("shared", "days")} onChange={(e) => set("shared", "days", toNum(e.target.value))} />}
          </Field>
          <Field label={c.fields.nights}>
            {(id) => <input id={id} type="number" min={0} max={30} className={input} value={num("shared", "nights")} onChange={(e) => set("shared", "nights", toNum(e.target.value))} />}
          </Field>
          <Field label={c.fields.priceVnd}>
            {(id) => <input id={id} type="number" min={0} step={1000} className={input} value={price.vnd ?? ""} onChange={(e) => set("shared", "price", { ...price, vnd: toNum(e.target.value) })} />}
          </Field>
          <Field label={c.fields.priceUsd}>
            {(id) => <input id={id} type="number" min={0} step={1} className={input} value={price.usd ?? ""} onChange={(e) => set("shared", "price", { ...price, usd: toNum(e.target.value) })} />}
          </Field>
          <Field label={c.fields.childPercent}>
            {(id) => <input id={id} type="number" min={0} max={100} className={input} value={pricing.childPercent ?? ""} onChange={(e) => setPricing({ childPercent: toNum(e.target.value) })} />}
          </Field>
          <Field label={c.fields.infantVnd}>
            {(id) => <input id={id} type="number" min={0} step={1000} className={input} value={pricing.infantVnd ?? ""} onChange={(e) => setPricing({ infantVnd: toNum(e.target.value) })} />}
          </Field>
          <Field label={c.fields.singleSupplementVnd}>
            {(id) => <input id={id} type="number" min={0} step={1000} className={input} value={pricing.singleSupplementVnd ?? ""} onChange={(e) => setPricing({ singleSupplementVnd: toNum(e.target.value) })} />}
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={section("shared").featured === true} onChange={(e) => set("shared", "featured", e.target.checked)} />
          {c.fields.featured}
        </label>
      </Panel>

      <Panel id={`${ids}-panel-vi`} labelledBy={`${ids}-tab-vi`} hidden={tab !== "vi"}>
        {textPanel("vi")}
      </Panel>
      <Panel id={`${ids}-panel-en`} labelledBy={`${ids}-tab-en`} hidden={tab !== "en"}>
        {textPanel("en")}
      </Panel>

      <Panel id={`${ids}-panel-seo`} labelledBy={`${ids}-tab-seo`} hidden={tab !== "seo"}>
        <p className="text-sm text-muted-foreground">{c.seo.intro}</p>
        {(["vi", "en"] as const).map((s) => {
          const title = text(s, "seoTitle");
          const description = text(s, "seoDescription");
          return (
            <fieldset key={s} className="grid gap-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">{c.tabs[s]}</legend>
              <Field label={c.fields.seoTitle} hint={`${c.seo.titleHint} ${c.seo.chars(title.length, 70)}`}>
                {(id, describedBy) => <input id={id} aria-describedby={describedBy} maxLength={70} className={input} value={title} onChange={(e) => set(s, "seoTitle", e.target.value)} />}
              </Field>
              <Field label={c.fields.seoDescription} hint={`${c.seo.descriptionHint} ${c.seo.chars(description.length, 160)}`}>
                {(id, describedBy) => <textarea id={id} aria-describedby={describedBy} maxLength={160} rows={3} className={area} value={description} onChange={(e) => set(s, "seoDescription", e.target.value)} />}
              </Field>
              <div className="rounded-md bg-muted p-3 text-sm" aria-label={c.seo.previewTitle}>
                <div className="text-xs text-muted-foreground">{c.seo.previewTitle}</div>
                <div className="mt-1 truncate text-base text-primary">{title || text(s, "title") || "—"}</div>
                <div className="text-xs text-muted-foreground">{`…/${s === "en" ? "en/" : ""}tours/${slug}`}</div>
                <p className="mt-1 line-clamp-2">{description || text(s, "summary") || "—"}</p>
              </div>
            </fieldset>
          );
        })}
      </Panel>

      <Panel id={`${ids}-panel-images`} labelledBy={`${ids}-tab-images`} hidden={tab !== "images"}>
        <ImageList
          label={c.fields.images}
          values={((section("shared").images as { src?: string; mediaId?: string }[]) ?? []).map((i) => i.src ?? i.mediaId ?? "")}
          available={images}
          onChange={(v) => set("shared", "images", v.map((ref) => (UUID.test(ref) ? { mediaId: ref } : { src: ref })))}
          c={c}
        />
      </Panel>

      <Panel id={`${ids}-panel-private`} labelledBy={`${ids}-tab-private`} hidden={tab !== "private"}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(priv)} onChange={(e) => set("shared", "private", e.target.checked ? { maxGuests: 10, tiers: [{ minGuests: 2 }] } : undefined)} />
          {c.fields.privateOn}
        </label>
        {priv && (
          <div className="grid gap-4">
            <Field label={c.fields.maxGuests}>
              {(id) => <input id={id} type="number" min={1} max={50} className={cn(input, "max-w-40")} value={priv.maxGuests ?? ""} onChange={(e) => set("shared", "private", { ...priv, maxGuests: toNum(e.target.value) })} />}
            </Field>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">{c.fields.tiers}</legend>
              {(priv.tiers ?? []).map((tier, i) => {
                const update = (patch: object) => set("shared", "private", { ...priv, tiers: (priv.tiers ?? []).map((t, j) => (j === i ? { ...t, ...patch } : t)) });
                return (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <label className="grid gap-1 text-xs">
                      {c.fields.minGuests}
                      <input type="number" min={1} className={cn(input, "w-28")} value={tier.minGuests ?? ""} onChange={(e) => update({ minGuests: toNum(e.target.value) })} />
                    </label>
                    <label className="grid gap-1 text-xs">
                      VND
                      <input type="number" min={0} step={1000} className={cn(input, "w-40")} value={tier.vnd ?? ""} onChange={(e) => update({ vnd: toNum(e.target.value) })} />
                    </label>
                    <label className="grid gap-1 text-xs">
                      USD
                      <input type="number" min={0} className={cn(input, "w-28")} value={tier.usd ?? ""} onChange={(e) => update({ usd: toNum(e.target.value) })} />
                    </label>
                    <IconButton label={`${c.remove} ${i + 1}`} onClick={() => set("shared", "private", { ...priv, tiers: (priv.tiers ?? []).filter((_, j) => j !== i) })}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                );
              })}
              <AddButton label={c.add} onClick={() => set("shared", "private", { ...priv, tiers: [...(priv.tiers ?? []), {}] })} />
            </fieldset>
          </div>
        )}
      </Panel>

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <SubmitButton label={c.save} pendingLabel={c.saving} />
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id, hint ? `${id}-hint` : undefined)}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function Panel({ id, labelledBy, hidden, children }: { id: string; labelledBy: string; hidden: boolean; children: ReactNode }) {
  return (
    <div role="tabpanel" id={id} aria-labelledby={labelledBy} hidden={hidden} className="grid gap-4">
      {children}
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40">
      {children}
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex w-fit items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-sm hover:bg-muted">
      <Plus className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

const move = <T,>(list: T[], i: number, by: number) => {
  const next = [...list];
  const [x] = next.splice(i, 1);
  next.splice(i + by, 0, x!);
  return next;
};

function RowControls<T>({ list, i, onChange, c }: { list: T[]; i: number; onChange: (v: T[]) => void; c: { up: string; down: string; remove: string } }) {
  return (
    <div className="flex gap-1">
      <IconButton label={`${c.up} ${i + 1}`} disabled={i === 0} onClick={() => onChange(move(list, i, -1))}>
        <ArrowUp className="size-4" />
      </IconButton>
      <IconButton label={`${c.down} ${i + 1}`} disabled={i === list.length - 1} onClick={() => onChange(move(list, i, 1))}>
        <ArrowDown className="size-4" />
      </IconButton>
      <IconButton label={`${c.remove} ${i + 1}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
        <Trash2 className="size-4" />
      </IconButton>
    </div>
  );
}

function StringList({ label, values, onChange, c }: { label: string; values: string[]; onChange: (v: string[]) => void; c: { add: string; up: string; down: string; remove: string } }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input aria-label={`${label} ${i + 1}`} className={input} value={v} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
          <RowControls list={values} i={i} onChange={onChange} c={c} />
        </div>
      ))}
      <AddButton label={c.add} onClick={() => onChange([...values, ""])} />
    </fieldset>
  );
}

function ItineraryList({ values, onChange, c }: { values: { title: string; description: string }[]; onChange: (v: { title: string; description: string }[]) => void; c: ReturnType<typeof getTourAdminContent> }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">{c.fields.itinerary}</legend>
      {values.map((day, i) => (
        <div key={i} className="grid gap-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">#{i + 1}</span>
            <RowControls list={values} i={i} onChange={onChange} c={c} />
          </div>
          <input aria-label={`${c.fields.dayTitle} ${i + 1}`} placeholder={c.fields.dayTitle} className={input} value={day.title ?? ""} onChange={(e) => onChange(values.map((d, j) => (j === i ? { ...d, title: e.target.value } : d)))} />
          <textarea aria-label={`${c.fields.dayDescription} ${i + 1}`} placeholder={c.fields.dayDescription} rows={3} className={area} value={day.description ?? ""} onChange={(e) => onChange(values.map((d, j) => (j === i ? { ...d, description: e.target.value } : d)))} />
        </div>
      ))}
      <AddButton label={c.add} onClick={() => onChange([...values, { title: "", description: "" }])} />
    </fieldset>
  );
}

function ImageList({ label, values, available, onChange, c }: { label: string; values: string[]; available: string[]; onChange: (v: string[]) => void; c: ReturnType<typeof getTourAdminContent> }) {
  const [pick, setPick] = useState("");
  const left = available.filter((a) => !values.includes(a));
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">{label}</legend>
      <ul className="grid gap-2 sm:grid-cols-2">
        {values.map((src, i) => (
          <li key={src} className="flex items-center gap-3 rounded-md border border-border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a local file */}
            <img src={src} alt="" className="h-14 w-20 rounded object-cover" />
            <span className="min-w-0 flex-1 truncate text-xs">{src}</span>
            <RowControls list={values} i={i} onChange={onChange} c={c} />
          </li>
        ))}
      </ul>
      {left.length > 0 && (
        <div className="flex gap-2">
          <select aria-label={c.fields.addImage} className={cn(input, "max-w-xs")} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">—</option>
            {left.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button type="button" disabled={!pick} onClick={() => (onChange([...values, pick]), setPick(""))} className="rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-40">
            {c.fields.addImage}
          </button>
        </div>
      )}
    </fieldset>
  );
}

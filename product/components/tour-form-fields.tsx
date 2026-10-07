"use client";

// Generic fields of the tour admin form (tour-form.tsx): labelled field, tab panel, reorderable lists.
import { useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { getTourAdminContent } from "../tours/admin-content";

export const input = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm";
export const area = "w-full rounded-md border border-border bg-background p-3 text-sm";

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }) {
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

export function Panel({ id, labelledBy, hidden, children }: { id: string; labelledBy: string; hidden: boolean; children: ReactNode }) {
  return (
    <div role="tabpanel" id={id} aria-labelledby={labelledBy} hidden={hidden} className="grid gap-4">
      {children}
    </div>
  );
}

export function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40">
      {children}
    </button>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
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

export function StringList({ label, values, onChange, c }: { label: string; values: string[]; onChange: (v: string[]) => void; c: { add: string; up: string; down: string; remove: string } }) {
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

export function ItineraryList({ values, onChange, c }: { values: { title: string; description: string }[]; onChange: (v: { title: string; description: string }[]) => void; c: ReturnType<typeof getTourAdminContent> }) {
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

export function ImageList({ label, values, available, onChange, c }: { label: string; values: string[]; available: string[]; onChange: (v: string[]) => void; c: ReturnType<typeof getTourAdminContent> }) {
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

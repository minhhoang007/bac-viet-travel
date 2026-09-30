import { setRequestLocale } from "next-intl/server";
import { requirePageUser } from "@/app/_lib/session";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { createNote } from "@/product/_example-notes/actions";
import { NoteForm } from "@/product/_example-notes/components/note-form";

export default async function NotesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { app, user } = await requirePageUser(locale);
  const c = getAppContent(locale).notes;
  const notes = await app.product.notes.list(user.id);

  return (
    <div className="grid gap-8">
      <h1 className="text-2xl font-bold">{c.title}</h1>
      <NoteForm locale={locale} action={createNote} labels={{ ...c, submit: c.create }} />
      {notes.length === 0 ? (
        <p className="text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {notes.map((note) => (
            <li key={note.id}>
              <a href={localePath(locale, `/dashboard/product/notes/${note.id}`)} className="block p-4 hover:bg-muted">
                <span className="font-medium">{note.title}</span>
                {note.body && <span className="mt-1 block truncate text-sm text-muted-foreground">{note.body}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

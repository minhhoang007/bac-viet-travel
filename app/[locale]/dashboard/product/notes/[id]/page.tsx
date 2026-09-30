import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requirePageUser } from "@/app/_lib/session";
import { isAppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getNotesContent } from "@/product/_example-notes/content";
import { deleteNote, updateNote } from "@/product/_example-notes/actions";
import { NoteForm } from "@/product/_example-notes/components/note-form";

export default async function NotePage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { app, user } = await requirePageUser(locale);
  const c = getNotesContent(locale);

  // Another user's note is NOT_FOUND (ownerId-scoped) → 404, never 403, so existence does not leak.
  const note = await app.product.notes.get(user.id, id).catch((error: unknown) => {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  });

  return (
    <div className="grid gap-6">
      <a href={localePath(locale, "/dashboard/product/notes")} className="text-sm text-primary underline">
        {c.back}
      </a>
      <NoteForm locale={locale} action={updateNote} note={note} labels={{ ...c, submit: c.save }} />
      <form action={deleteNote}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={note.id} />
        <button type="submit" className="rounded-md border border-red-600/40 px-4 py-2 text-sm text-red-600">
          {c.delete}
        </button>
      </form>
    </div>
  );
}

import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requirePageUser } from "@/app/_lib/session";
import { isAppError } from "@/core/errors";
import { localePath } from "@/core/i18n/routing";
import { PageHeader } from "@/components/app-shell/page-header";
import { getAppContent } from "@/content";
import type { Locale } from "@/config/app";
import { getNotesContent } from "@/product/_example-notes/content";
import { deleteNote, updateNote } from "@/product/_example-notes/actions";
import { SubmitButton } from "@/components/forms/submit-button";
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
      <PageHeader
        title={note.title}
        breadcrumb={{
          label: getAppContent(locale).dashboard.shell.breadcrumb,
          items: [{ label: c.title, href: localePath(locale, "/dashboard/product/notes") }, { label: note.title }],
        }}
      />
      <NoteForm locale={locale} action={updateNote} note={note} labels={{ ...c, submit: c.save }} />
      <form action={deleteNote}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={note.id} />
        <SubmitButton label={c.delete} variant="outline" className="border-danger/40 text-danger" />
      </form>
    </div>
  );
}

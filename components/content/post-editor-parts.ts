import type { ReactNode } from "react";
import type { Locale } from "@/config/app";

/** A media library image offered to a project's editor part (media module on). */
export type LibraryImage = { id: string; name: string; thumb: string; src: string };

/** What the Cover and Body parts get: the library and its uploader (media module on), and `plain`, the starter's own field to show instead when the part has nothing better. */
export type EditorMedia = { library?: LibraryImage[]; uploader?: ReactNode; plain: ReactNode };

/**
 * The project's own parts of the post editor (product/layout.tsx `loadProductPostEditor`), each replacing the
 * starter's plain field. `Cover` posts `cover` (and `coverCreditName` / `coverCreditUrl` for a credited photo),
 * `Body` posts `body`; `Aside` goes under the workflow panel (e.g. writing checks reading the form `formId`).
 * Declare the project's object with `satisfies PostEditorParts` so a change on either side fails the type check.
 */
export interface PostEditorParts {
  Cover?: (p: EditorMedia & { locale: Locale; name: string; label: string; initial?: { src: string; credit?: { name: string; url: string } } }) => ReactNode;
  Body?: (p: EditorMedia & { locale: Locale; id: string; name: string; describedBy: string; defaultValue: string }) => ReactNode | Promise<ReactNode>;
  Aside?: (p: { locale: Locale; formId: string }) => ReactNode;
}

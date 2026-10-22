import type { ReactNode } from "react";
import { getPublicTours } from "@/app/_lib/tours";
import type { Locale } from "@/config/app";
import { ImagePicker } from "../components/image-picker";
import { MarkdownEditor } from "../components/markdown-editor";
import { PostSeoCheck } from "../components/post-seo-check";
import { getImagePickerText, getMarkdownEditorText, getSeoCheckText } from "../media/content";

type LibraryImage = { id: string; name: string; thumb: string; src: string };
type Media = { library?: LibraryImage[]; uploader?: ReactNode; plain: ReactNode };

// Free photos tab (optional key): read per request, never at module load.
const unsplashOn = () => Boolean(process.env.UNSPLASH_ACCESS_KEY);

/**
 * The post editor's project parts (starter hook `productPostEditor`): a cover picker (library, upload, Unsplash), a
 * Markdown toolbar that inserts photos and tour cards, and the writing checks beside the form.
 */
export const productPostEditor = {
  Cover({ locale, name, label, initial, library, uploader, plain }: Media & { locale: Locale; name: string; label: string; initial?: { src: string; credit?: { name: string; url: string } } }) {
    const unsplash = unsplashOn();
    if (!library && !unsplash) return plain;
    return <ImagePicker name={name} label={label} initial={initial} library={library} uploader={uploader} unsplash={unsplash} t={getImagePickerText(locale)} />;
  },
  async Body({ locale, id, name, describedBy, defaultValue, library, uploader }: Media & { locale: Locale; id: string; name: string; describedBy: string; defaultValue: string }) {
    const tours = (await getPublicTours()).list(locale).map((tour) => ({ slug: tour.slug, title: tour.title }));
    return (
      <MarkdownEditor
        id={id}
        name={name}
        describedBy={describedBy}
        defaultValue={defaultValue}
        t={getMarkdownEditorText(locale)}
        picker={{ t: getImagePickerText(locale), library, uploader, unsplash: unsplashOn() }}
        tours={tours}
      />
    );
  },
  Aside({ locale, formId }: { locale: Locale; formId: string }) {
    return <PostSeoCheck formId={formId} t={getSeoCheckText(locale)} />;
  },
};

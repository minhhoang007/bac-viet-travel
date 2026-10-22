import { getPublicTours } from "@/app/_lib/tours";
import type { PostEditorParts } from "@/components/content/post-editor-parts";
import { ImagePicker } from "../components/image-picker";
import { MarkdownEditor } from "../components/markdown-editor";
import { PostSeoCheck } from "../components/post-seo-check";
import { getImagePickerText, getMarkdownEditorText, getSeoCheckText } from "../media/content";

// Free photos tab (optional key): read per request, never at module load.
const unsplashOn = () => Boolean(process.env.UNSPLASH_ACCESS_KEY);

/**
 * The post editor's project parts (starter hook, loaded by product/layout.tsx `loadProductPostEditor`): a cover picker
 * (library, upload, Unsplash), a Markdown toolbar that inserts photos and tour cards, and the writing checks.
 */
export const productPostEditor = {
  Cover({ locale, name, label, initial, library, uploader, plain }) {
    const unsplash = unsplashOn();
    if (!library && !unsplash) return plain;
    return <ImagePicker name={name} label={label} initial={initial} library={library} uploader={uploader} unsplash={unsplash} t={getImagePickerText(locale)} />;
  },
  async Body({ locale, id, name, describedBy, defaultValue, library, uploader }) {
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
  Aside({ locale, formId }) {
    return <PostSeoCheck formId={formId} t={getSeoCheckText(locale)} />;
  },
} satisfies PostEditorParts;

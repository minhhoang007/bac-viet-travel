"use client";

// Create forms (e.g. a post): the web address follows the title until the user edits it themselves, so non-technical
// staff never have to work out a slug.
import { useState, type ReactNode } from "react";
import { slugify } from "./slug";

export function SlugFromTitle(props: {
  titleLabel: ReactNode;
  titleName: string;
  titleMaxLength: number;
  slugLabel: ReactNode;
  slugHint: ReactNode;
  className: string;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [edited, setEdited] = useState(false);
  return (
    <>
      <label className="grid gap-1 text-sm">
        {props.titleLabel}
        <input
          name={props.titleName}
          required
          maxLength={props.titleMaxLength}
          className={props.className}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!edited) setSlug(slugify(e.target.value));
          }}
        />
      </label>
      <label className="grid gap-1 text-sm">
        {props.slugLabel}
        <input
          name="slug"
          required
          maxLength={110}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          aria-describedby="slug-hint"
          className={props.className}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setEdited(true);
          }}
        />
        <span id="slug-hint" className="text-xs text-muted-foreground">
          {props.slugHint}
        </span>
      </label>
    </>
  );
}

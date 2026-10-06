// Project-owned: where the public site reads tours from.
// "content": published tours in the database (CMS, edited in the admin). "mdx": files in content/tours (the
// pre-CMS source, kept as a one-line rollback until the CMS has run for a while).
export const tourSource: "content" | "mdx" = "content";

// Project-owned: override starter defaults here.
import { blogDefaults, type BlogConfig } from "./blog.defaults";

// Posts are written by marketing in the admin (/admin/posts) and reviewed like tours (S4).
export const blogConfig: BlogConfig = { ...blogDefaults, source: "content", defaultAuthor: "Bắc Việt Travel" };

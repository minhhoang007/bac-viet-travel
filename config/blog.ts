// Project-owned: override starter defaults here.
import { blogDefaults, type BlogConfig } from "./blog.defaults";

// Posts are written by marketing in the admin (/admin/posts) and reviewed like tours (S4).
export const blogConfig: BlogConfig = {
  ...blogDefaults,
  source: "content",
  defaultAuthor: "Bắc Việt Travel",
  // Writers' profiles: add a person here (name as typed in the post's "Author" field) with a role and a short bio.
  authors: {
    "Bắc Việt Travel": { organization: true, url: "/about" },
  },
  // Tags whose slug is a destination ("ha-long", "ninh-binh", "sapa") also pick the tours shown under a post.
  tagLabels: {
    "ha-long": { vi: "Hạ Long", en: "Ha Long" },
    "ninh-binh": { vi: "Ninh Bình", en: "Ninh Binh" },
    sapa: { vi: "Sapa", en: "Sapa" },
    "ha-giang": { vi: "Hà Giang", en: "Ha Giang" },
    "cat-ba": { vi: "Cát Bà", en: "Cat Ba" },
    "mai-chau": { vi: "Mai Châu", en: "Mai Chau" },
    "ha-noi": { vi: "Hà Nội", en: "Hanoi" },
    "kinh-nghiem": { vi: "Kinh nghiệm", en: "Tips" },
    "travel-tips": { vi: "Kinh nghiệm", en: "Travel tips" },
    trekking: { vi: "Trekking", en: "Trekking" },
    "du-thuyen": { vi: "Du thuyền", en: "Cruise" },
    "am-thuc": { vi: "Ẩm thực", en: "Food" },
  },
};

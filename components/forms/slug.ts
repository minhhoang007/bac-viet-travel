/** Web address from a Vietnamese title: "Ninh Bình 2 ngày: Tràng An" → "ninh-binh-2-ngay-trang-an". */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110)
    .replace(/-+$/, "");
}

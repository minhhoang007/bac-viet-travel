import type { Locale } from "@/config/app";
import type { ImagePickerText } from "../components/image-picker";
import type { MarkdownEditorText } from "../components/markdown-editor";
import type { SeoCheckText } from "../components/post-seo-check";

const vi: ImagePickerText = {
  choose: "Chọn ảnh",
  change: "Đổi ảnh",
  remove: "Bỏ ảnh",
  title: "Chọn ảnh",
  description: "Ảnh của công ty trong thư viện, tải ảnh mới lên, hoặc chọn ảnh miễn phí trên Unsplash (tên tác giả được ghi tự động).",
  tabs: { library: "Thư viện", upload: "Tải lên", unsplash: "Ảnh miễn phí (Unsplash)" },
  libraryEmpty: "Thư viện chưa có ảnh.",
  search: "Tìm ảnh, ví dụ: ruộng bậc thang Sapa",
  searchButton: "Tìm",
  searching: "Đang tìm…",
  noResults: "Không có ảnh phù hợp. Thử từ khoá khác (tiếng Anh thường cho nhiều kết quả hơn).",
  unavailable: "Unsplash đang không trả lời (có thể đã hết lượt tìm trong giờ). Thử lại sau ít phút.",
  use: "Dùng ảnh này",
  credit: "Ảnh: {name} / Unsplash",
};

const en: ImagePickerText = {
  choose: "Choose image",
  change: "Change image",
  remove: "Remove image",
  title: "Choose an image",
  description: "Your library, a new upload, or a free Unsplash photo (the photographer is credited automatically).",
  tabs: { library: "Library", upload: "Upload", unsplash: "Free photos (Unsplash)" },
  libraryEmpty: "The library is empty.",
  search: "Search, e.g. Sapa rice terraces",
  searchButton: "Search",
  searching: "Searching…",
  noResults: "No matching photos. Try other words.",
  unavailable: "Unsplash is not answering (the hourly search limit may be reached). Try again in a few minutes.",
  use: "Use this photo",
  credit: "Photo: {name} / Unsplash",
};

export const getImagePickerText = (locale: Locale): ImagePickerText => (locale === "en" ? en : vi);

const editorVi: MarkdownEditorText = {
  toolbar: "Định dạng nội dung",
  bold: "Chữ đậm",
  heading: "Tiêu đề mục",
  list: "Danh sách",
  link: "Chèn link",
  note: "Khung ghi chú",
  image: "Chèn ảnh",
  tour: "Chèn tour…",
  sample: { bold: "chữ đậm", heading: "Tiêu đề mục", item: "Ý thứ nhất", link: "chữ có link", note: "Lưu ý cho khách" },
  photoBy: "Ảnh:",
};

const editorEn: MarkdownEditorText = {
  toolbar: "Formatting",
  bold: "Bold",
  heading: "Section heading",
  list: "List",
  link: "Insert link",
  note: "Note box",
  image: "Insert image",
  tour: "Insert a tour…",
  sample: { bold: "bold text", heading: "Section heading", item: "First point", link: "linked text", note: "A tip for travellers" },
  photoBy: "Photo:",
};

export const getMarkdownEditorText = (locale: Locale): MarkdownEditorText => (locale === "en" ? editorEn : editorVi);

const seoVi: SeoCheckText = {
  heading: "Kiểm tra trước khi gửi",
  hint: "Gợi ý để bài lên Google tốt và giữ chân người đọc; không bắt buộc.",
  title: "Tiêu đề 20–65 ký tự (hiện có {n}): Google cắt bớt tiêu đề dài.",
  description: "Mô tả 70–160 ký tự (hiện có {n}): Google hiện đoạn này dưới tiêu đề.",
  cover: "Có ảnh bìa: hiện khi chia sẻ lên Zalo, Facebook.",
  sections: "Ít nhất 3 mục ## (hiện có {n}): có mục lục, dễ đọc lướt.",
  length: "Từ 600 chữ (hiện có {n}): bài cẩm nang đủ ý.",
  alt: "Ảnh nào cũng có mô tả (còn {n} ảnh thiếu): giúp Google hiểu ảnh.",
  tour: "Có thẻ tour hoặc link tới một tour: người đọc biết đặt ở đâu.",
};

const seoEn: SeoCheckText = {
  heading: "Before you submit",
  hint: "Tips for Google and readers; none of them is required.",
  title: "Title of 20–65 characters (now {n}): Google cuts long titles.",
  description: "Description of 70–160 characters (now {n}): shown under the title on Google.",
  cover: "A cover image: shown when shared on Zalo or Facebook.",
  sections: "At least 3 ## sections (now {n}): contents box, easy to skim.",
  length: "600 words or more (now {n}): a complete guide.",
  alt: "Every image described ({n} missing): helps Google read them.",
  tour: "A tour card or a link to a tour: readers know where to book.",
};

export const getSeoCheckText = (locale: Locale): SeoCheckText => (locale === "en" ? seoEn : seoVi);

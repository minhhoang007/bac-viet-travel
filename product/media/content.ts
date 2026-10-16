import type { Locale } from "@/config/app";
import type { ImagePickerText } from "../components/image-picker";

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

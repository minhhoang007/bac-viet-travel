import type { Locale } from "@/config/app";

export interface NotesContent {
  title: string;
  empty: string;
  titleLabel: string;
  bodyLabel: string;
  create: string;
  save: string;
  delete: string;
  back: string;
  errors: { required: string; too_long: string; error: string };
}

const content: Record<Locale, NotesContent> = {
  vi: {
    title: "Ghi chú",
    empty: "Chưa có ghi chú nào.",
    titleLabel: "Tiêu đề",
    bodyLabel: "Nội dung",
    create: "Thêm ghi chú",
    save: "Lưu",
    delete: "Xoá",
    back: "Quay lại",
    errors: { required: "Vui lòng nhập tiêu đề.", too_long: "Nội dung quá dài.", error: "Đã có lỗi. Vui lòng thử lại." },
  },
  en: {
    title: "Notes",
    empty: "No notes yet.",
    titleLabel: "Title",
    bodyLabel: "Body",
    create: "Add note",
    save: "Save",
    delete: "Delete",
    back: "Back",
    errors: { required: "Please enter a title.", too_long: "This is too long.", error: "Something went wrong. Please try again." },
  },
};

export function getNotesContent(locale: Locale): NotesContent {
  return content[locale];
}

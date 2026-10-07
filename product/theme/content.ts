import type { Locale } from "@/config/app";
import type { ThemeMode, ThemeName } from "./themes";

/** Admin text for /admin/appearance. */
const vi = {
  title: "Giao diện",
  intro: "Chọn phong cách cho toàn bộ web. Bố cục giữ nguyên; màu, font chữ, góc bo và kiểu tiêu đề thay đổi theo theme. Áp dụng ngay sau khi lưu, không cần deploy.",
  theme: "Theme",
  mode: "Chế độ sáng / tối",
  current: "Đang dùng",
  save: "Lưu giao diện",
  view: "Xem trang chủ",
  themes: {
    lacquer: { name: "A · Sơn Mài", text: "Đen sơn mài, chữ ngà, điểm đồng thau. Tiêu đề serif mảnh. Sang, trầm (mặc định)." },
    paper: { name: "B · Giấy Dó", text: "Nền giấy, mực đen, xanh rêu. Tiêu đề serif đậm nét kiểu tạp chí in." },
    mist: { name: "C · Sương", text: "Xám xanh như sương sớm, tiêu đề chữ mảnh viết hoa, góc bo mềm. Tối giản." },
    tomato: { name: "D · Tạp chí", text: "Trắng đen, tiêu đề chữ hẹp viết hoa, một điểm hồng. Hiện đại, mạnh." },
    jade: { name: "E · Ngọc Vịnh", text: "Xanh nước vịnh sâu, điểm ngọc bích, tiêu đề serif thanh. Mát, yên." },
  } satisfies Record<ThemeName, { name: string; text: string }>,
  native: { light: "sáng", dark: "tối" },
  modes: {
    native: "Gốc của theme",
    light: "Luôn sáng",
    dark: "Luôn tối",
    auto: "Theo máy khách (sáng hoặc tối theo cài đặt điện thoại/máy tính)",
  } satisfies Record<ThemeMode, string>,
  nativeOf: (scheme: string) => `gốc: ${scheme}`,
  result: {
    done: "Đã lưu. Web đang dùng giao diện mới.",
    invalid: "Theme hoặc chế độ không hợp lệ.",
    failed: "Không lưu được.",
  } as Record<string, string>,
};

const en: typeof vi = {
  title: "Appearance",
  intro: "Pick the style of the whole website. The layout stays; colors, fonts, corners and headings follow the theme. Applied as soon as you save, no deploy needed.",
  theme: "Theme",
  mode: "Light / dark",
  current: "In use",
  save: "Save appearance",
  view: "View home page",
  themes: {
    lacquer: { name: "A · Lacquer", text: "Lacquer black, ivory text, brass accents. Fine serif headings. Quiet luxury (default)." },
    paper: { name: "B · Dó Paper", text: "Paper and ink with moss green. Strong serif headings like a printed magazine." },
    mist: { name: "C · Mist", text: "Morning-mist grey-green, thin capital headings, soft corners. Minimal." },
    tomato: { name: "D · Magazine", text: "Black and white, condensed capital headings, one magenta accent. Bold, modern." },
    jade: { name: "E · Jade Bay", text: "Deep bay water with jade accents and slender serif headings. Calm." },
  },
  native: { light: "light", dark: "dark" },
  modes: {
    native: "Theme's own",
    light: "Always light",
    dark: "Always dark",
    auto: "Follow the visitor (light or dark from their device setting)",
  },
  nativeOf: (scheme: string) => `own: ${scheme}`,
  result: {
    done: "Saved. The website now uses the new appearance.",
    invalid: "Invalid theme or mode.",
    failed: "Could not save.",
  },
};

export const getThemeContent = (locale: Locale) => (locale === "en" ? en : vi);

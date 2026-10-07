// Project-owned: header links (after the "Destinations" menu, which lists DESTINATIONS).
import type { NavLink } from "./navigation.defaults";

export const siteNavigation: NavLink[] = [
  { href: "/tours", label: { vi: "Tour ghép", en: "Tours" } },
  { href: "/#contact", label: { vi: "Tour riêng", en: "Private" } },
  { href: "/blog", label: { vi: "Cẩm nang", en: "Travel notes" } },
  { href: "/about", label: { vi: "Về chúng tôi", en: "About" } },
];

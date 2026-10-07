/** Unsplash photos used on the site (Unsplash License: free to use, attribution appreciated). */
export const photoCredits = [
  { file: "/tours/halong-1.jpg", author: "Marina Lobato", username: "mlobatopl", photo: "kG7pOXbBfNs" },
  { file: "/tours/halong-2.jpg", author: "Giuliano Gabella", username: "ggabella91", photo: "QQ9vWTP3eGo" },
  { file: "/tours/halong-3.jpg", author: "Warren", username: "wflwong", photo: "-HtfdIHSbsE" },
  { file: "/tours/ninhbinh-1.jpg", author: "Jacob Pretorius", username: "jacobdotearth", photo: "6Rm7o1eEIgc" },
  { file: "/tours/ninhbinh-2.jpg", author: "Jonathan Ouimet", username: "mtlwebdesign", photo: "JF4o7WErDn8" },
  { file: "/tours/ninhbinh-3.jpg", author: "Fernando Strabuli", username: "fernandostrabuli456", photo: "wl_3yExsNsg" },
  { file: "/tours/sapa-1.jpg", author: "Krisztian Tabori", username: "ktabori", photo: "9r2yeRccyls" },
  { file: "/tours/sapa-2.jpg", author: "Denis Sobnakov", username: "sobden", photo: "RCtykLYUCVY" },
  { file: "/tours/sapa-3.jpg", author: "Pilar C.", username: "pilarc", photo: "DwOASqt4KLY" },
  { file: "/tours/halong-4.jpg", author: "Fuu J", username: "fuuj", photo: "TvB_S0cB2ik" },
  { file: "/tours/ninhbinh-4.jpg", author: "Just Filip", username: "justfilip", photo: "Mt1iIhkBk1I" },
  { file: "/tours/sapa-4.jpg", author: "Huy Nguyen", username: "huynguyen_pch", photo: "OBD62-MyPAQ" },
] as const;

/** Pexels videos (Pexels License: free to use, attribution appreciated). */
export const videoCredits = [
  { file: "/video/hero-poster.jpg", author: "Sergey Guk", url: "https://www.pexels.com/video/aerial-view-of-ha-long-bay-at-sunset-30391319/" },
] as const;

export const unsplashPhotoUrl = (photo: string) => `https://unsplash.com/photos/${photo}?utm_source=bac_viet_travel&utm_medium=referral`;
export const unsplashUserUrl = (username: string) => `https://unsplash.com/@${username}?utm_source=bac_viet_travel&utm_medium=referral`;

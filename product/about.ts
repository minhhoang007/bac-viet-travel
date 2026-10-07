import type { Locale } from "@/config/app";

// Project-owned: About page copy. Marketing edits this file; company facts (licence, tax code…) come from config/contact.ts.
// Story and team are placeholders for the demo: replace with the company's real story, people and photos.

const vi = {
  title: "Giới thiệu Bắc Việt Travel",
  /** <title> (the site name is appended): without repeating the brand. */
  metaTitle: "Về chúng tôi",
  description: "Công ty lữ hành tại Hà Nội, chuyên tour ghép và tour riêng Hạ Long, Ninh Bình, Sapa cho khách Việt và quốc tế.",
  intro:
    "Tour ghép và tour riêng tới Hạ Long, Ninh Bình và Sapa, do chính chúng tôi vận hành cùng hướng dẫn viên người địa phương.",
  storyTitle: "Câu chuyện của chúng tôi",
  story: [
    "Bắt đầu từ những chuyến đi cùng bạn bè quốc tế khám phá miền Bắc, chúng tôi nhận ra du khách cần một đơn vị nói thật về lịch trình, giá và trải nghiệm, không phát sinh, không bất ngờ.",
    "Hôm nay, mỗi tour của Bắc Việt đều được đội ngũ đi thử trước khi mở bán, và mỗi đối tác (du thuyền, nhà xe, homestay) đều được kiểm tra định kỳ.",
  ],
  whyTitle: "Vì sao chọn Bắc Việt",
  why: [
    { title: "Giá minh bạch", text: "Giá hiển thị đã gồm những gì ghi trong tour. Không phí ẩn, cọc 30% online, phần còn lại thanh toán trước ngày đi." },
    { title: "Đặt chỗ tức thì", text: "Xem số chỗ còn theo từng ngày, giữ chỗ và cọc online trong vài phút, nhận xác nhận qua email." },
    { title: "Hướng dẫn viên địa phương", text: "Hướng dẫn viên tiếng Việt và tiếng Anh, sinh ra và lớn lên ở nơi bạn đến." },
    { title: "Hỗ trợ 7 ngày/tuần", text: "Zalo, WhatsApp và hotline trước, trong và sau chuyến đi." },
  ],
  teamTitle: "Đội ngũ",
  team: [
    { name: "Nguyễn Văn A", role: "Giám đốc điều hành" },
    { name: "Trần Thị B", role: "Trưởng bộ phận tour" },
    { name: "Lê Văn C", role: "Hướng dẫn viên tiếng Anh" },
  ],
  legalTitle: "Thông tin pháp lý",
  partnersTitle: "Đối tác",
  partners: "Du thuyền 4–5 sao tại vịnh Hạ Long và Lan Hạ, nhà xe limousine Hà Nội – Hạ Long – Sapa, homestay và khách sạn tại Ninh Bình, Sapa.",
  cta: "Xem các tour",
  contact: "Liên hệ tư vấn",
};

type AboutContent = typeof vi;

const en: AboutContent = {
  title: "About Bắc Việt Travel",
  metaTitle: "About us",
  description: "A Hanoi tour operator running group and private tours to Ha Long Bay, Ninh Binh and Sapa for Vietnamese and international travellers.",
  intro:
    "Group and private tours to Ha Long Bay, Ninh Binh and Sapa, run by us from Hanoi with local guides.",
  storyTitle: "Our story",
  story: [
    "It started with trips showing friends from abroad around Northern Vietnam. Travellers wanted someone honest about itineraries, prices and experiences: no hidden costs, no surprises.",
    "Today every Bắc Việt tour is tested by our team before it goes on sale, and every partner (cruise, transport, homestay) is reviewed regularly.",
  ],
  whyTitle: "Why travel with us",
  why: [
    { title: "Transparent prices", text: "The price includes everything listed in the tour. No hidden fees: 30% deposit online, the rest before departure." },
    { title: "Instant booking", text: "See seats left for each date, hold and pay the deposit online in minutes, get your confirmation by email." },
    { title: "Local guides", text: "English- and Vietnamese-speaking guides who were born and raised where you are going." },
    { title: "Support 7 days a week", text: "WhatsApp, Zalo and hotline before, during and after your trip." },
  ],
  teamTitle: "Our team",
  team: [
    { name: "Nguyễn Văn A", role: "Managing director" },
    { name: "Trần Thị B", role: "Head of tours" },
    { name: "Lê Văn C", role: "English-speaking guide" },
  ],
  legalTitle: "Company information",
  partnersTitle: "Partners",
  partners: "4–5 star cruises in Ha Long and Lan Ha Bay, limousine transport Hanoi – Ha Long – Sapa, homestays and hotels in Ninh Binh and Sapa.",
  cta: "Browse tours",
  contact: "Ask us anything",
};

export const getAboutContent = (locale: Locale): AboutContent => (locale === "en" ? en : vi);

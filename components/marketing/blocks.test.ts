import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LogoCloud } from "./logo-cloud";
import { Pricing } from "./pricing";
import { ProblemSolution } from "./problem-solution";
import { Steps } from "./steps";
import { Testimonials } from "./testimonials";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("landing blocks", () => {
  it("Pricing renders plans, the highlighted badge and an h1 when asked", () => {
    const plans = [
      { name: "Free", price: "0", cta: { label: "Start", href: "/login" } },
      { name: "Pro", price: "199.000 ₫", period: "/ tháng", features: ["A", "B"], cta: { label: "Buy", href: "#contact" }, highlighted: true, badge: "Popular" },
    ];
    const out = html(createElement(Pricing, { as: "h1", title: "Pricing", plans }));
    expect(out).toContain("<h1");
    expect(out).toContain("199.000 ₫");
    expect(out).toContain("Popular");
    expect(out).toContain('href="#contact"');
    expect(out.match(/<article/g)).toHaveLength(2);
  });

  it("Pricing hides the badge on plans that are not highlighted", () => {
    const out = html(createElement(Pricing, { title: "P", plans: [{ name: "X", price: "1", badge: "Hot", cta: { label: "Go", href: "/" } }] }));
    expect(out).not.toContain("Hot");
    expect(out).toContain("<h2");
  });

  it("Steps numbers its items in an ordered list", () => {
    const out = html(createElement(Steps, { title: "How", items: [{ title: "One", description: "a" }, { title: "Two", description: "b" }] }));
    expect(out).toContain("<ol");
    expect(out.match(/<li/g)).toHaveLength(2);
  });

  it("ProblemSolution shows both sides with decorative icons hidden", () => {
    const out = html(createElement(ProblemSolution, { title: "Why", before: { title: "Before", items: ["slow"] }, after: { title: "After", items: ["fast"] } }));
    expect(out).toContain("slow");
    expect(out).toContain("fast");
    expect(out).toContain('aria-hidden="true"');
  });

  it("Testimonials and LogoCloud give images the right alt text", () => {
    const t = html(createElement(Testimonials, { title: "Love", items: [{ quote: "Great", name: "An", role: "Founder", avatar: "/a.png" }] }));
    expect(t).toContain("<blockquote");
    expect(t).toContain('alt=""'); // the name is right next to the avatar
    const l = html(createElement(LogoCloud, { title: "Trusted by", items: [{ name: "Acme", src: "/acme.svg", href: "https://acme.test" }] }));
    expect(l).toContain('alt="Acme"');
    expect(l).toContain('href="https://acme.test"');
  });
});

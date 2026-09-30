import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";

describe("serializeJsonLd", () => {
  it("round-trips data", () => {
    const data = { "@context": "https://schema.org", "@type": "Organization", name: "Hạ Long & Co" };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("cannot close the script element or inject markup", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toMatch(/<|>/);
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});

import { describe, expect, it } from "vitest";
import { csvResponse } from "./csv";

const body = async (rows: (string | number | null)[][]) => (await csvResponse("x.csv", ["a", "b"], rows).text()).replace(/^﻿/, "");

describe("csvResponse", () => {
  it("neutralises text that starts a formula, but keeps negative numbers as numbers", async () => {
    expect(await body([["=HYPERLINK(1)", -300000], ["-1+1", null]])).toBe('"a","b"\r\n"\'=HYPERLINK(1)","-300000"\r\n"\'-1+1",""\r\n');
  });
});

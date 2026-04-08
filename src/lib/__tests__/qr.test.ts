import { describe, it, expect } from "vitest";
import { generateQRDataURL } from "../qr";

describe("generateQRDataURL", () => {
  it("returns a data URL string for a given text", async () => {
    const result = await generateQRDataURL("https://example.com/join/ABC123");
    expect(typeof result).toBe("string");
    expect(result.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("works with short codes", async () => {
    const result = await generateQRDataURL("ABC123");
    expect(result.length).toBeGreaterThan(100);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { getQrUrl } from "./site-config";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("getQrUrl", () => {
  it("depends only on the configured origin and immutable slug", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://identity.example";
    const slug = "aB3dE5fG7hJ9";

    expect(getQrUrl(slug)).toBe("https://identity.example/p/aB3dE5fG7hJ9");
    expect(getQrUrl(slug)).toBe(getQrUrl(slug));
  });

  it("does not change when unrelated information changes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://identity.example";
    const slug = "aB3dE5fG7hJ9";
    const before = getQrUrl(slug);
    const information = { fullName: "Initial", showPhoto: false, documentCount: 0 };

    information.fullName = "Updated";
    information.showPhoto = true;
    information.documentCount = 4;

    expect(getQrUrl(slug)).toBe(before);
  });

  it("rejects a slug that is too short or contains other data", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://identity.example";

    expect(() => getQrUrl("short")).toThrow("Invalid immutable profile slug");
    expect(() => getQrUrl("name@example.com")).toThrow("Invalid immutable profile slug");
  });

  it("rejects a missing site URL", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(() => getQrUrl("aB3dE5fG7hJ9")).toThrow("NEXT_PUBLIC_SITE_URL is required");
  });
});
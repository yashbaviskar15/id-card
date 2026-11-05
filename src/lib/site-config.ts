import { z } from "zod";

const publicConfigSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().refine((value) => !value.endsWith("/"), {
    message: "NEXT_PUBLIC_SITE_URL must not end with a slash"
  })
});

export function getSiteUrl(): string {
  const result = publicConfigSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
  });

  if (!result.success) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required and must be a URL without a trailing slash");
  }

  return result.data.NEXT_PUBLIC_SITE_URL;
}

export function getQrUrl(slug: string): string {
  if (!/^[A-Za-z0-9_-]{12,}$/.test(slug)) {
    throw new Error("Invalid immutable profile slug");
  }

  return `${getSiteUrl()}/p/${slug}`;
}
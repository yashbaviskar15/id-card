import { renderQrSvg } from "@/lib/qr";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[A-Za-z0-9_-]{12,}$/.test(slug)) return new Response("Not found", { status: 404 });

  return new Response(await renderQrSvg(slug), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="identity-card-qr.svg"`
    }
  });
}
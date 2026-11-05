import { renderQrPng } from "@/lib/qr";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[A-Za-z0-9_-]{12,}$/.test(slug)) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(await renderQrPng(slug, 1024)), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="identity-card-qr.png"`
    }
  });
}
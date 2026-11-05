import { getVisitorProfile } from "@/lib/visitor-profile";

export const dynamic = "force-dynamic";

function escapeVCard(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[A-Za-z0-9_-]{12,}$/.test(slug)) return new Response("Unauthorized", { status: 401 });

  const profile = await getVisitorProfile(slug);
  if (!profile) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });

  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeVCard(profile.fullName)}`];
  for (const phone of profile.phones) lines.push(`TEL;TYPE=${escapeVCard(phone.label)}:${escapeVCard(phone.value)}`);
  for (const email of profile.emails) lines.push(`EMAIL;TYPE=${escapeVCard(email.label)}:${escapeVCard(email.value)}`);
  if (profile.address) lines.push(`ADR:;;${escapeVCard(profile.address)};;;;`);
  lines.push("END:VCARD");

  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="contact.vcf"`
    }
  });
}
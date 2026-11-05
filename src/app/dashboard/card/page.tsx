import { requireOwner } from "@/lib/auth";

export default async function CardPage() {
  const { supabase, user } = await requireOwner();
  const { data: profile } = await supabase.from("profiles").select("slug").eq("owner_id", user.id).maybeSingle();
  return <Section title="Card and QR" text={profile ? "Your QR downloads are generated from the permanent profile URL." : "Create your profile first to generate the permanent QR URL."} link={profile ? `/p/${profile.slug}/qr.svg` : undefined} />;
}

function Section({ title, text, link }: { title: string; text: string; link?: string }) {
  return <><h2>{title}</h2><div className="dashboard-panel"><p className="dashboard-muted">{text}</p>{link && <a className="text-link" href={link}>Download QR SVG</a>}</div></>;
}
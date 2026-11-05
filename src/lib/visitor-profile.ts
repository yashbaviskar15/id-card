import "server-only";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { readVisitorSession, visitorSessionCookieName } from "@/lib/visitor-session";

export type VisitorProfile = {
  fullName: string;
  emails: Array<{ label: string; value: string }>;
  phones: Array<{ label: string; value: string }>;
  photoPath: string | null;
  dob: string | null;
  address: string | null;
};

export async function getVisitorProfile(slug: string): Promise<VisitorProfile | null> {
  const session = readVisitorSession((await cookies()).get(visitorSessionCookieName)?.value);
  if (!session || session.slug !== slug) return null;

  const admin = getAdminClient();
  const { data: grant } = await admin.from("access_grants").select("scope, session_expires_at, revoked_at").eq("id", session.grantId).eq("slug", slug).maybeSingle();
  if (!grant || grant.revoked_at || !grant.session_expires_at || Date.parse(grant.session_expires_at) <= Date.now()) return null;

  const { data: profile } = await admin.from("profiles").select("full_name, dob, address, photo_path, show_dob, show_address, show_photo, is_active, owner_id").eq("slug", slug).maybeSingle();
  if (!profile || !profile.is_active) return null;

  const { data: fields } = await admin.from("fields").select("kind, label, value, is_public, sort").eq("owner_id", profile.owner_id).in("kind", ["email", "phone"]).eq("is_public", true).order("sort");
  const contactFields = (fields ?? []).map((field) => ({ label: field.label, value: field.value }));
  const emails = (fields ?? []).filter((field) => field.kind === "email").map(({ label, value }) => ({ label, value }));
  const phones = (fields ?? []).filter((field) => field.kind === "phone").map(({ label, value }) => ({ label, value }));

  return {
    fullName: profile.full_name,
    emails,
    phones,
    photoPath: grant.scope === "full" && profile.show_photo ? profile.photo_path : null,
    dob: grant.scope === "full" && profile.show_dob ? profile.dob : null,
    address: grant.scope === "full" && profile.show_address ? profile.address : null
  };
}
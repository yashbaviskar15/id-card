import Link from "next/link";
import { getQrUrl } from "@/lib/site-config";
import { requireOwner } from "@/lib/auth";

export default async function DashboardPage() {
  const { supabase, user } = await requireOwner();
  const { data: profile } = await supabase.from("profiles").select("slug, full_name, is_active").eq("owner_id", user.id).maybeSingle();

  return (
    <>
      <h2>Overview</h2>
      <p className="dashboard-muted">Owner-only controls for the private card and its protected information.</p>
      {!profile ? (
        <div className="dashboard-panel">
          <h3>Finish initial setup</h3>
          <p className="dashboard-muted">Create the profile once. Its random slug will remain unchanged when information is edited.</p>
          <Link className="text-link" href="/dashboard/setup">Create profile</Link>
        </div>
      ) : (
        <div className="dashboard-panel">
          <h3>{profile.full_name || "Unnamed profile"}</h3>
          <p className="dashboard-muted">Status: {profile.is_active ? "active" : "disabled"}</p>
          <p><code>{getQrUrl(profile.slug)}</code></p>
        </div>
      )}
    </>
  );
}
import { requireOwner } from "@/lib/auth";

export default async function SettingsPage() {
  await requireOwner();
  return <Section title="Settings" text="Security settings, session revocation, the profile kill switch, and backup controls will be managed here." />;
}

function Section({ title, text }: { title: string; text: string }) { return <><h2>{title}</h2><div className="dashboard-panel"><p className="dashboard-muted">{text}</p></div></>; }
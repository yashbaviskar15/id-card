import { requireOwner } from "@/lib/auth";

export default async function AccessPage() {
  await requireOwner();
  return <Section title="Access" text="Access grants and the owner-controlled code display will appear here after the grant management actions are connected." />;
}

function Section({ title, text }: { title: string; text: string }) { return <><h2>{title}</h2><div className="dashboard-panel"><p className="dashboard-muted">{text}</p></div></>; }
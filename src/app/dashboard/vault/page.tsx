import { requireOwner } from "@/lib/auth";

export default async function VaultPage() {
  await requireOwner();
  return <Section title="Vault" text="Private documents will be available here after storage upload and signed-download actions are connected." />;
}

function Section({ title, text }: { title: string; text: string }) { return <><h2>{title}</h2><div className="dashboard-panel"><p className="dashboard-muted">{text}</p></div></>; }
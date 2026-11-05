import { requireOwner } from "@/lib/auth";

export default async function InformationPage() {
  await requireOwner();
  return <Section title="Information" text="Personal fields and privacy switches will be managed here. The QR slug remains independent of every field." />;
}

function Section({ title, text }: { title: string; text: string }) { return <><h2>{title}</h2><div className="dashboard-panel"><p className="dashboard-muted">{text}</p></div></>; }
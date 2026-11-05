import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOut } from "./actions";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireOwner();
  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <aside className="dashboard-nav">
          <h1>Private identity card</h1>
          <nav aria-label="Owner dashboard">
            <Link href="/dashboard">Overview</Link>
            <Link href="/dashboard/card">Card and QR</Link>
            <Link href="/dashboard/access">Access</Link>
            <Link href="/dashboard/vault">Vault</Link>
            <Link href="/dashboard/information">Information</Link>
            <Link href="/dashboard/settings">Settings</Link>
          </nav>
          <form action={signOut}><button className="dashboard-signout" type="submit">Sign out</button></form>
        </aside>
        <section className="dashboard-main">{children}</section>
      </div>
    </main>
  );
}
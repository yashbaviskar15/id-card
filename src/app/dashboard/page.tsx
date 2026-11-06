import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { getProfile, loadCardData } from '@/lib/card/load';
import { IdCard } from '@/components/card/id-card';
import { qrPayload } from '@/lib/qr/payload';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShieldCheck, QrCode, Globe, Settings, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Dashboard' };

export default async function DashboardOverviewPage() {
  const owner = await requireOwner();
  const profile = await getProfile(owner.id);
  const card = profile ? await loadCardData(owner.id) : null;

  return (
    <div className="space-y-12">
      <header className="relative">
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-ink/5 blur-3xl" />
        <h1 className="text-4xl font-black tracking-tighter text-ink">Dashboard</h1>
        <p className="mt-2 text-lg font-medium text-label max-w-2xl">
          Welcome back. Manage your digital identity, secure vault, and access permissions from one place.
        </p>
      </header>

      {!profile || !card ? (
        <section className="relative overflow-hidden rounded-[32px] border border-hairline bg-white p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
          <div className="relative z-10 max-w-xl">
            <h2 className="text-3xl font-black tracking-tight text-ink">Initialize Your Identity</h2>
            <p className="mt-4 text-base font-medium leading-relaxed text-label">
              You haven't created your identity card yet. Setting it up generates a permanent QR code and a unique profile link that will stay yours forever.
            </p>
            <Link href="/dashboard/card" className="mt-8 inline-block">
              <Button className="h-14 px-10 rounded-2xl bg-ink text-white font-black text-lg shadow-xl shadow-ink/20 transition-all hover:scale-105 active:scale-95">
                Create My Card
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-ink/5 to-transparent hidden lg:block" />
        </section>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2 space-y-8">
            <div className="rounded-[32px] border border-hairline bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_25px_60px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-ink animate-pulse" />
                  <h2 className="text-[10px] font-black tracking-[0.3em] text-label uppercase">Live Preview</h2>
                </div>
                <Link href="/dashboard/card">
                  <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase tracking-widest text-label hover:text-ink">
                    Customize
                  </Button>
                </Link>
              </div>
              
              <div className="flex justify-center items-center py-6 bg-[#f8f9fa] rounded-[24px] border border-hairline/50 overflow-hidden">
                <div className="scale-[0.6] sm:scale-[0.8] lg:scale-[0.85] origin-center">
                  <IdCard face="front" data={card} className="shadow-2xl" />
                </div>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-[28px] border border-hairline bg-white p-6 shadow-sm hover:shadow-md transition-all group">
                <div className="h-12 w-12 rounded-2xl bg-ink/5 flex items-center justify-center text-ink mb-4 group-hover:bg-ink group-hover:text-white transition-all">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-ink">Vault Storage</h3>
                <p className="mt-2 text-sm font-medium text-label leading-relaxed">
                  Store and manage your private documents securely.
                </p>
                <Link href="/dashboard/vault" className="mt-4 flex items-center text-xs font-black uppercase tracking-widest text-ink hover:gap-2 transition-all">
                  Open Vault <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </div>

              <div className="rounded-[28px] border border-hairline bg-white p-6 shadow-sm hover:shadow-md transition-all group">
                <div className="h-12 w-12 rounded-2xl bg-ink/5 flex items-center justify-center text-ink mb-4 group-hover:bg-ink group-hover:text-white transition-all">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-ink">Access Control</h3>
                <p className="mt-2 text-sm font-medium text-label leading-relaxed">
                  Generate temporary codes to grant profile access.
                </p>
                <Link href="/dashboard/access" className="mt-4 flex items-center text-xs font-black uppercase tracking-widest text-ink hover:gap-2 transition-all">
                  Manage Access <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </div>
            </div>
          </section>

          <aside className="space-y-8">
            <div className="rounded-[32px] border border-hairline bg-white p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="h-5 w-5 text-ink" />
                <h2 className="text-sm font-black text-ink uppercase tracking-wider">Permanent URL</h2>
              </div>
              <div className="rounded-2xl bg-[#f8f9fa] p-4 font-mono text-xs break-all text-ink border border-hairline">
                {qrPayload(card.slug)}
              </div>
              <p className="mt-4 text-xs font-medium leading-relaxed text-label">
                This address and its generated QR code are fixed forever.
              </p>
              <Link href="/dashboard/card" className="mt-6 block">
                <Button variant="outline" className="w-full rounded-xl border-2 border-ink font-black text-xs uppercase tracking-widest hover:bg-ink hover:text-white transition-all">
                  <QrCode className="mr-2 h-4 w-4" />
                  Get QR Code
                </Button>
              </Link>
            </div>

            <div className="rounded-[32px] border border-hairline bg-ink p-8 text-white shadow-xl shadow-ink/20">
              <div className="flex items-center gap-3 mb-6 text-white/60">
                <Settings className="h-5 w-5" />
                <h2 className="text-sm font-black uppercase tracking-wider">Privacy Status</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold opacity-60">Status</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    profile.is_active ? "bg-white text-ink" : "bg-destructive text-white"
                  )}>
                    {profile.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="opacity-60">Profile Photo</span>
                    <span>{profile.show_photo ? 'Shared' : 'Hidden'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="opacity-60">Date of Birth</span>
                    <span>{profile.show_dob ? 'Shared' : 'Hidden'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="opacity-60">Home Address</span>
                    <span>{profile.show_address ? 'Shared' : 'Hidden'}</span>
                  </div>
                </div>
                <Link href="/dashboard/settings" className="mt-6 block">
                  <Button variant="ghost" className="w-full rounded-xl border border-white/20 font-black text-xs uppercase tracking-widest hover:bg-white hover:text-ink transition-all">
                    Privacy Settings
                  </Button>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

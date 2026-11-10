'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NavLinks } from './nav-links';

export function MobileDashboardNav({
  accountMenu,
  themeToggle,
}: {
  accountMenu: React.ReactNode;
  themeToggle: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between border-b border-page-border bg-white/85 px-4 backdrop-blur lg:hidden">
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <BrandMark />
        <span className="text-sm font-semibold tracking-tight text-ink">Private Identity</span>
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open navigation" />}>
          <Menu className="h-5 w-5 text-ink" />
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(20rem,calc(100vw-1rem))] gap-0 p-0">
          <SheetHeader className="border-b border-page-border p-5 text-left">
            <SheetTitle className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
              <BrandMark />
              Private Identity
            </SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <NavLinks layout="sheet" />
            </div>
            <div className="space-y-3 border-t border-page-border p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
              <div className="space-y-2">
                <p className="eyebrow px-1">Appearance</p>
                {themeToggle}
              </div>
              <div className="border-t border-page-border" />
              {accountMenu}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

import Link from 'next/link';
import { requireOwner } from '@/lib/auth/session';
import { NavLinks } from './nav-links';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Menu, LogOut, User } from 'lucide-react';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();

  return (
    <div className="min-h-dvh bg-[#f8f9fa]">
      <header className="no-print sticky top-0 z-30 border-b border-hairline bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 xl:gap-6">
            <Link href="/dashboard" className="group flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-ink flex items-center justify-center text-white font-bold text-xl transition-all group-hover:rotate-6">P</div>
              <span className="text-xl font-black tracking-tighter text-ink hidden sm:inline-block">
                Identity
              </span>
            </Link>
            
            <div className="hidden 2xl:block">
              <NavLinks />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden min-w-0 max-w-56 flex-col items-end xl:flex xl:mr-2">
              <span className="text-[10px] font-bold text-label uppercase tracking-widest">Account</span>
              <span className="max-w-full truncate text-sm font-semibold text-ink">{owner.email}</span>
            </div>

            <div className="hidden md:block">
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="outline" size="sm" className="rounded-full border-2 border-ink font-black hover:bg-ink hover:text-white transition-all active:scale-95">
                  Sign out
                </Button>
              </form>
            </div>

            <div className="2xl:hidden">
              <Sheet>
                <SheetTrigger
                  render={<Button variant="ghost" size="icon" className="rounded-xl" />}
                  aria-label="Open dashboard navigation"
                >
                  <Menu className="h-6 w-6 text-ink" />
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="max-h-dvh w-[min(22rem,calc(100vw-1rem))] p-0"
                >
                  <SheetHeader className="p-6 border-b border-hairline text-left">
                    <SheetTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-ink flex items-center justify-center text-white font-bold text-lg">P</div>
                      Identity
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <div className="min-h-0 flex-1 p-4">
                      <div className="space-y-1">
                        <NavLinks mobile />
                      </div>
                    </div>
                    <div className="sticky bottom-0 mt-auto border-t border-hairline bg-[#f8f9fa] p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-full bg-white border border-hairline flex items-center justify-center">
                          <User className="h-5 w-5 text-label" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-label uppercase tracking-widest leading-none">Logged in as</span>
                          <span className="text-sm font-bold text-ink truncate max-w-[180px]">{owner.email}</span>
                        </div>
                      </div>
                      <form action="/auth/signout" method="post">
                        <Button type="submit" className="w-full h-12 rounded-xl bg-ink text-white font-black flex items-center justify-center gap-2 shadow-lg shadow-ink/20">
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </Button>
                      </form>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">{children}</main>
    </div>
  );
}

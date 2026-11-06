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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="group flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-ink flex items-center justify-center text-white font-bold text-xl transition-all group-hover:rotate-6">P</div>
              <span className="text-xl font-black tracking-tighter text-ink hidden sm:inline-block">
                Identity
              </span>
            </Link>
            
            <div className="hidden lg:block">
              <NavLinks />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex flex-col items-end mr-4">
              <span className="text-[10px] font-bold text-label uppercase tracking-widest">Account</span>
              <span className="text-sm font-bold text-ink">{owner.email}</span>
            </div>

            <div className="hidden md:block">
              <form action="/auth/signout" method="post">
                <Button variant="outline" size="sm" className="rounded-full border-2 border-ink font-black hover:bg-ink hover:text-white transition-all active:scale-95">
                  Sign out
                </Button>
              </form>
            </div>

            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger
                  render={<Button variant="ghost" size="icon" className="rounded-xl" />}
                  aria-label="Open dashboard navigation"
                >
                  <Menu className="h-6 w-6 text-ink" />
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0">
                  <SheetHeader className="p-6 border-b border-hairline text-left">
                    <SheetTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-ink flex items-center justify-center text-white font-bold text-lg">P</div>
                      Identity
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col h-[calc(100%-80px)]">
                    <div className="flex-1 p-4">
                      <div className="space-y-1">
                        <NavLinks mobile />
                      </div>
                    </div>
                    <div className="p-6 bg-[#f8f9fa] border-t border-hairline mt-auto">
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
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

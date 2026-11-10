'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from 'cn';

type ShellTheme = 'light' | 'dark' | 'system';

const OPTIONS: { value: ShellTheme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

/**
 * One three-in-one control for the dashboard shell: light, dark and system.
 * Every option lives in a single segmented switch, sized full-width so it lines
 * up with the account menu in the sidebar footer and the mobile sheet footer.
 *
 * `theme` is undefined until next-themes mounts, so nothing is highlighted on
 * the very first paint — that keeps the server and client markup identical.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = mounted ? (theme as ShellTheme | undefined) : undefined;

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={cn(
        'inline-flex w-full items-center gap-1 rounded-xl border border-page-border bg-muted p-1',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink',
              active ? 'bg-ink text-white shadow-card' : 'text-label hover:bg-ink/5 hover:text-ink',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

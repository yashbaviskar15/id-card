import { cn } from 'cn';

/**
 * Shared brand logo. Drawn as inline SVG so it renders instantly with no extra
 * network request — which also means it is available on the offline launch
 * screen. The glyph matches the generated PWA/install icons in `public/icons`.
 */
export function BrandMark({
  size = 32,
  className,
  title = 'Private Identity',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      role="img"
      aria-label={title}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn('shrink-0', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="11" fill="#111827" />
      <rect x="8" y="12" width="32" height="24" rx="5" fill="#FFFFFF" />
      <rect x="12" y="16.5" width="10" height="11" rx="2" fill="#F3F4F6" stroke="#DDE1E7" strokeWidth="0.9" />
      <circle cx="17" cy="20.4" r="1.7" fill="#DDE1E7" />
      <path d="M14 25.4h6" stroke="#DDE1E7" strokeWidth="1.1" strokeLinecap="round" />
      <rect x="25" y="16.5" width="11" height="2.6" rx="1.3" fill="#111827" />
      <rect x="25" y="21" width="9.5" height="2" rx="1" fill="#DDE1E7" />
      <rect x="25" y="24.6" width="10.5" height="2" rx="1" fill="#DDE1E7" />
    </svg>
  );
}

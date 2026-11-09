import { cn } from 'cn';

/**
 * Shared brand logo. Inline SVG keeps the mark available offline and matches
 * the checked-in PWA/install icons.
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
      <rect width="48" height="48" rx="9" fill="#000000" />
      <path
        d="M15 9.5h10.4c8.3 0 13.1 4.1 13.1 11.4 0 7.2-4.8 11.5-13.1 11.5H22v7.5H15V9.5Zm7 6.8v9.4h3.5c4 0 6.1-1.4 6.1-4.7 0-3.2-2.1-4.7-6.1-4.7H22Z"
        fill="#FFFFFF"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}

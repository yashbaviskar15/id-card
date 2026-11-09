import Image from 'next/image';
import { cn } from 'cn';

/**
 * Shared SVG logo. Explicit dimensions preserve layout, while the service
 * worker caches the same asset for the offline screen.
 */
export function BrandMark({
  className,
  title = 'Private Identity',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <Image
      src="/logo.svg"
      alt={title}
      width={40}
      height={40}
      className={cn('shrink-0', className)}
      unoptimized
    />
  );
}

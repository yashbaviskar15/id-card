import Image from 'next/image';
import { cn } from 'cn';

/** Shared raster logo with explicit dimensions to preserve layout. */
export function BrandMark({
  className,
  title = 'Private Identity',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt={title}
      width={40}
      height={40}
      className={cn('brand-mark shrink-0', className)}
      unoptimized
    />
  );
}

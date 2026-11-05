import QRCode from 'qrcode';
import { qrPayload } from '@/lib/qr/payload';

/**
 * In-page QR rendered as React <rect> elements from the module matrix — no
 * dangerouslySetInnerHTML, no stored image.
 */
export function QrSvg({
  slug,
  size = 160,
  className,
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  const qr = QRCode.create(qrPayload(slug), { errorCorrectionLevel: 'H' });
  const count = qr.modules.size;
  const data = qr.modules.data;
  const quiet = 4;
  const total = count + quiet * 2;
  const scale = size / total;

  const rects: React.ReactElement[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!data[row * count + col]) continue;
      rects.push(
        <rect
          key={`${row}-${col}`}
          x={(col + quiet) * scale}
          y={(row + quiet) * scale}
          width={scale}
          height={scale}
        />,
      );
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Profile QR code"
      className={className}
      fill="#111827"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#FFFFFF" />
      {rects}
    </svg>
  );
}

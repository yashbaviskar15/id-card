/**
 * Renders a TOTP enrollment QR from the module matrix returned by the server
 * action as React <rect> elements — no dangerouslySetInnerHTML. The matrix
 * comes from the enrollment `otpauth://` URI, not from the profile slug.
 */
export function TotpQr({
  matrix,
  size = 176,
  className,
}: {
  matrix: { size: number; data: number[] };
  size?: number;
  className?: string;
}) {
  const quiet = 4;
  const total = matrix.size + quiet * 2;
  const scale = size / total;

  const rects: React.ReactElement[] = [];
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.data[row * matrix.size + col]) continue;
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
      aria-label="Two-factor setup QR code"
      className={className}
      fill="#111827"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#FFFFFF" />
      {rects}
    </svg>
  );
}

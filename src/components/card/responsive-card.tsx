'use client';

import { useEffect, useRef, useState } from 'react';
import { IdCard, type CardData, CARD_WIDTH_PX, CARD_HEIGHT_PX } from './id-card';
import { cn } from 'cn';

export function ResponsiveCard({
  face,
  data,
  className,
}: {
  face: 'front' | 'back';
  data: CardData;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0) {
        const containerWidth = entry.contentRect.width;
        setScale(Math.min(1, containerWidth / CARD_WIDTH_PX));
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('relative aspect-[856/540] w-full min-w-0 overflow-hidden', className)}
      role="img"
      aria-label={`${face === 'front' ? 'Front' : 'Back'} of the identity card preview`}
    >
      <div
        style={{
          transform: `scale(${scale ?? 0})`,
          transformOrigin: 'top left',
          width: CARD_WIDTH_PX,
          height: CARD_HEIGHT_PX,
          opacity: scale === null ? 0 : 1,
          transition: 'opacity 0.15s ease-out',
        }}
      >
        <IdCard face={face} data={data} className="shadow-none" />
      </div>
    </div>
  );
}

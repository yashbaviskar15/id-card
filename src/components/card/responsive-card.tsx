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
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
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
      className={cn("w-full overflow-hidden", className)}
      style={{ 
        height: CARD_HEIGHT_PX * scale,
        transition: 'height 0.2s ease-out'
      }}
    >
      <div 
        style={{ 
          transform: `scale(${scale})`, 
          transformOrigin: 'top left',
          width: CARD_WIDTH_PX,
          height: CARD_HEIGHT_PX
        }}
      >
        <IdCard face={face} data={data} className="shadow-none" />
      </div>
    </div>
  );
}

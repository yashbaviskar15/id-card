import 'server-only';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { CardData } from '@/lib/card/data';
import { buildCardSvg } from '@/lib/export/card-svg';

/**
 * Raster export of the identity card. The card is rendered to SVG first (the
 * single source of the artwork) and then rasterised with the self-hosted
 * Manrope font, so PNG and PDF output is byte-stable for a given input.
 */

export const CARD_DPI = 300;
export const CARD_TRIM_MM = { width: 85.6, height: 53.98 } as const;
export const BLEED_MM = 3;

const MANROPE_TTF = path.join(process.cwd(), 'public', 'fonts', 'manrope-variable.ttf');

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

/** 1011 x 638 px at 300 DPI for the exact ID-1 trim size. */
export const CARD_PNG_WIDTH = mmToPx(CARD_TRIM_MM.width, CARD_DPI); // 1011
export const BLEED_PX = mmToPx(BLEED_MM, CARD_DPI); // 35

export interface CardRenderOptions {
  face: 'front' | 'back';
  data: CardData;
  bleed?: boolean;
}

export function renderCardPngSync({ face, data, bleed = false }: CardRenderOptions): Buffer {
  const { svg } = buildCardSvg({
    face,
    data,
    widthPx: CARD_PNG_WIDTH,
    bleedPx: bleed ? BLEED_PX : 0,
  });
  const resvg = new Resvg(svg, {
    background: 'white',
    font: { loadSystemFonts: false, fontFiles: [MANROPE_TTF], defaultFontFamily: 'Manrope' },
  });
  return Buffer.from(resvg.render().asPng());
}

export async function renderCardPng(options: CardRenderOptions): Promise<Buffer> {
  return renderCardPngSync(options);
}

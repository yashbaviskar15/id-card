import 'server-only';
import { PDFDocument } from 'pdf-lib';
import type { CardData } from '@/lib/card/data';
import { CARD_TRIM_MM, BLEED_MM, renderCardPng } from '@/lib/export/card-image';

/**
 * Print-ready PDF of the identity card. One page per face, sized to the exact
 * ID-1 trim (or trim + bleed), with the 300 DPI raster placed edge to edge.
 */

const PT_PER_MM = 72 / 25.4;

export interface CardPdfOptions {
  data: CardData;
  faces?: 'front' | 'back' | 'both';
  bleed?: boolean;
}

export async function renderCardPdf({
  data,
  faces = 'both',
  bleed = false,
}: CardPdfOptions): Promise<Uint8Array> {
  const wanted: Array<'front' | 'back'> =
    faces === 'both' ? ['front', 'back'] : [faces];

  const bleedMm = bleed ? BLEED_MM * 2 : 0;
  const pageWidth = (CARD_TRIM_MM.width + bleedMm) * PT_PER_MM;
  const pageHeight = (CARD_TRIM_MM.height + bleedMm) * PT_PER_MM;

  const pdf = await PDFDocument.create();
  pdf.setTitle('Identity card');
  pdf.setProducer('Private Identity Card');

  for (const face of wanted) {
    const png = await renderCardPng({ face, data, bleed });
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }

  return pdf.save();
}

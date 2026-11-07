import QRCode from 'qrcode';
import type { CardData } from '@/lib/card/data';
import { qrPayload } from '@/lib/qr/payload';

/**
 * Server-side vector rendering of the identity card. This is the exact artwork
 * used for print/PDF export, built from the same tokens as the on-screen card
 * (src/components/card/id-card.tsx) so the two never drift.
 *
 * It is a pure function of the card data and the slug: nothing is stored and no
 * rendering is time- or environment-dependent, so the output is deterministic.
 */

/** ID-1 proportions rendered at an 856 px base width. */
export const CARD_BASE_WIDTH = 856;
export const CARD_BASE_HEIGHT = 540;

const INK = '#111827';
const LABEL = '#5B6472';
const HAIRLINE = '#DDE1E7';
const SUBTLE_LINE = '#E5E7EB';
const PHOTO_PLACEHOLDER = '#F3F4F6';
const WHITE = '#FFFFFF';

const PAD = 48;
const RADIUS = 32;

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function estimate(text: string, size: number, factor: number): number {
  return text.length * size * factor;
}

/** Greedy word wrap using a per-character width estimate (no font metrics needed). */
function wrap(text: string, maxWidth: number, size: number, factor: number, maxLines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && estimate(candidate, size, factor) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}

function truncate(text: string, maxWidth: number, size: number, factor: number): string {
  if (estimate(text, size, factor) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && estimate(`${out}…`, size, factor) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function text(opts: {
  x: number;
  y: number;
  size: number;
  weight: number;
  fill: string;
  content: string;
  letterSpacing?: number;
  anchor?: 'start' | 'middle' | 'end';
}): string {
  const spacing = opts.letterSpacing ? ` letter-spacing="${opts.letterSpacing}"` : '';
  const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : '';
  return `<text x="${opts.x}" y="${opts.y}" font-family="Manrope" font-size="${opts.size}" font-weight="${opts.weight}" fill="${opts.fill}"${spacing}${anchor}>${escapeXml(opts.content)}</text>`;
}

/** QR drawn as rects from the module matrix, quiet zone 4 modules, EC level H. */
function qrRects(slug: string, size: number, x: number, y: number): string {
  const qr = QRCode.create(qrPayload(slug), { errorCorrectionLevel: 'H' });
  const count = qr.modules.size;
  const data = qr.modules.data;
  const quiet = 4;
  const total = count + quiet * 2;
  const cell = size / total;
  const parts: string[] = [`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${WHITE}"/>`];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!data[row * count + col]) continue;
      const cx = (x + (col + quiet) * cell).toFixed(3);
      const cy = (y + (row + quiet) * cell).toFixed(3);
      const wh = cell.toFixed(3);
      parts.push(`<rect x="${cx}" y="${cy}" width="${wh}" height="${wh}"/>`);
    }
  }
  return `<g fill="${INK}" shape-rendering="crispEdges">${parts.join('')}</g>`;
}

/** Very faint concentric lines in the lower-right corner (centre 792, 476). */
function concentric(): string {
  return (
    `<g fill="none" stroke="${INK}" stroke-opacity="0.06">` +
    [30, 50, 70, 90]
      .map((r) => `<circle cx="792" cy="476" r="${(r * 0.64).toFixed(2)}"/>`)
      .join('') +
    `</g>`
  );
}

function clipPath(id: string): string {
  return `<clipPath id="${id}"><rect x="0" y="0" width="${CARD_BASE_WIDTH}" height="${CARD_BASE_HEIGHT}" rx="${RADIUS}"/></clipPath>`;
}

/** 172 x 216 photo frame; an embedded data-URI photo is clipped to the frame. */
function photoFrame(data: CardData, id: string): string {
  const w = 172;
  const h = 216;
  const frame =
    `<rect x="${PAD}" y="${PAD}" width="${w}" height="${h}" rx="12" fill="${PHOTO_PLACEHOLDER}" stroke="${SUBTLE_LINE}"/>`;
  if (data.photoUrl) {
    return (
      `<defs><clipPath id="${id}-photo"><rect x="${PAD}" y="${PAD}" width="${w}" height="${h}" rx="12"/></clipPath></defs>` +
      `<image href="${escapeXml(data.photoUrl)}" x="${PAD}" y="${PAD}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id}-photo)"/>`
    );
  }
  return (
    frame +
    text({
      x: PAD + w / 2,
      y: PAD + h / 2 + 5,
      size: 13,
      weight: 400,
      fill: LABEL,
      content: 'PHOTO',
      letterSpacing: 1.8,
      anchor: 'middle',
    })
  );
}

function frontBody(data: CardData, id: string): string {
  const parts: string[] = [];

  parts.push(photoFrame(data, id));

  const columnX = PAD + 172 + 32;

  parts.push(
    text({
      x: columnX,
      y: 63,
      size: 13,
      weight: 400,
      fill: LABEL,
      content: 'IDENTITY CARD',
      letterSpacing: 2.6,
    }),
  );

  const nameLines = wrap(data.fullName, 556, 44, 0.56);
  nameLines.forEach((line, index) => {
    parts.push(
      text({ x: columnX, y: 110 + index * 48, size: 44, weight: 700, fill: INK, content: line }),
    );
  });

  const fieldsTop = 154 + (nameLines.length - 1) * 48;
  const colWidth = 262;
  const col2X = columnX + colWidth + 32;

  const field = (label: string, value: string | null, x: number, top: number) => {
    const shown = value && value.trim() ? truncate(value.trim(), colWidth, 18, 0.53) : '—';
    parts.push(
      text({ x, y: top + 11, size: 13, weight: 400, fill: LABEL, content: label, letterSpacing: 1.82 }),
    );
    parts.push(text({ x, y: top + 35, size: 18, weight: 600, fill: INK, content: shown }));
  };

  field('DATE OF BIRTH', data.dob, columnX, fieldsTop);
  field('PHONE', data.phone, col2X, fieldsTop);
  field('EMAIL', data.email, columnX, fieldsTop + 61);

  return (
    `<g clip-path="url(#${id})">` +
    `<rect x="0" y="0" width="${CARD_BASE_WIDTH}" height="${CARD_BASE_HEIGHT}" fill="${WHITE}"/>` +
    `<rect x="0" y="0" width="${CARD_BASE_WIDTH}" height="8" fill="${INK}"/>` +
    parts.join('') +
    concentric() +
    `</g>`
  );
}

function backBody(data: CardData, id: string): string {
  const parts: string[] = [];

  const tileX = PAD;
  const tileSize = 314;
  const tileY = (CARD_BASE_HEIGHT - tileSize) / 2;

  // QR tile: white plaque, thin grey border, soft neutral shadow.
  parts.push(
    `<rect x="${tileX}" y="${tileY}" width="${tileSize}" height="${tileSize}" rx="16" fill="${WHITE}" stroke="${SUBTLE_LINE}" filter="url(#tileShadow)"/>`,
  );
  parts.push(qrRects(data.slug, 280, tileX + 17, tileY + 17));

  const textX = tileX + tileSize + 48;
  const maxWidth = 340;

  parts.push(
    text({ x: textX, y: 232, size: 13, weight: 400, fill: LABEL, content: 'ACCESS', letterSpacing: 2.6 }),
  );

  const headline = wrap('Scan, then enter the code I give you.', maxWidth, 22, 0.52, 2);
  headline.forEach((line, index) => {
    parts.push(text({ x: textX, y: 272 + index * 30, size: 22, weight: 600, fill: INK, content: line }));
  });

  const noteY = 272 + headline.length * 30 + 4;
  parts.push(
    text({
      x: textX,
      y: noteY,
      size: 14,
      weight: 400,
      fill: LABEL,
      content: 'The code is valid once and for a few minutes only.',
    }),
  );

  return (
    `<defs><filter id="tileShadow" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="${INK}" flood-opacity="0.08"/>` +
    `</filter></defs>` +
    `<g clip-path="url(#${id})">` +
    `<rect x="0" y="0" width="${CARD_BASE_WIDTH}" height="${CARD_BASE_HEIGHT}" fill="${WHITE}"/>` +
    parts.join('') +
    `<rect x="0" y="0" width="${CARD_BASE_WIDTH}" height="8" fill="${INK}" transform="translate(0 532)"/>` +
    concentric() +
    `</g>`
  );
}

export interface CardSvgOptions {
  face: 'front' | 'back';
  data: CardData;
  /** Width of the card body in output pixels (excludes bleed). */
  widthPx: number;
  /** Bleed in output pixels applied on every side. */
  bleedPx?: number;
}

export interface CardSvgResult {
  svg: string;
  width: number;
  height: number;
  scale: number;
}

export function buildCardSvg({ face, data, widthPx, bleedPx = 0 }: CardSvgOptions): CardSvgResult {
  const scale = widthPx / CARD_BASE_WIDTH;
  const bodyHeight = CARD_BASE_HEIGHT * scale;
  const width = widthPx + bleedPx * 2;
  const height = bodyHeight + bleedPx * 2;
  const id = `card-${face}`;
  const body = face === 'front' ? frontBody(data, id) : backBody(data, id);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${WHITE}"/>` +
    `<defs>${clipPath(id)}</defs>` +
    `<g transform="translate(${bleedPx} ${bleedPx}) scale(${scale})">` +
    body +
    `<rect x="0" y="0" width="${CARD_BASE_WIDTH}" height="${CARD_BASE_HEIGHT}" rx="${RADIUS}" fill="none" stroke="${HAIRLINE}"/>` +
    `</g>` +
    `</svg>`;

  return { svg, width: Math.round(width), height: Math.round(height), scale };
}

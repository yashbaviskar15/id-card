import 'server-only';
import QRCode from 'qrcode';
import { qrPayload } from '@/lib/qr/payload';

/**
 * Fixed QR renderer settings (invariant 8.9): error correction level H, a quiet
 * zone of 4 modules. No QR image is ever stored — it is rendered on demand from
 * the payload, so the output is deterministic.
 */
export const QR_RENDER_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 4,
} as const;

export async function renderQrSvg(slug: string): Promise<string> {
  return QRCode.toString(qrPayload(slug), { ...QR_RENDER_OPTIONS, type: 'svg' });
}

export async function renderQrPng(slug: string, width: number): Promise<Buffer> {
  return QRCode.toBuffer(qrPayload(slug), { ...QR_RENDER_OPTIONS, type: 'png', width });
}

import "server-only";
import QRCode from "qrcode";
import { getQrUrl } from "@/lib/site-config";

export function qrUrlForSlug(slug: string): string {
  return getQrUrl(slug);
}

export function renderQrSvg(slug: string): Promise<string> {
  return QRCode.toString(qrUrlForSlug(slug), {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 4,
    width: 3000
  });
}

export function renderQrPng(slug: string, width: number): Promise<Buffer> {
  return QRCode.toBuffer(qrUrlForSlug(slug), {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 4,
    width
  });
}
import QRCode from "qrcode";
import type { EsEventRow } from "../../types/database";
import { ES_FORMAT_LABELS, esEventCategoryLabels } from "../../lib/eventspaceRules";
import { eventMediaUrl } from "../../lib/eventspace";

/* ------------------------------------------------------------------ */
/*  Event Promotion Kit — graphics generation.                         */
/*  100% offline: SVG string templates + local QR encoding. No APIs.   */
/*  SECURITY GUARD: only PUBLIC event fields are ever drawn here.      */
/*  Private submission data, judge notes or files can never reach a    */
/*  promo graphic because these functions accept only the event row    */
/*  fields listed below and throw if given anything else.              */
/* ------------------------------------------------------------------ */

export type PromoSize = "square" | "portrait" | "story" | "landscape";

export const PROMO_SIZES: Record<PromoSize, { w: number; h: number; label: string; hint: string }> = {
  square: { w: 1080, h: 1080, label: "Square post", hint: "1080 × 1080 · feed posts" },
  portrait: { w: 1080, h: 1350, label: "Portrait post", hint: "1080 × 1350 · taller feed" },
  story: { w: 1080, h: 1920, label: "Story", hint: "1080 × 1920 · stories/reels" },
  landscape: { w: 1200, h: 630, label: "Landscape card", hint: "1200 × 630 · link previews / LinkedIn" },
};

/** Whitelist of the ONLY fields promo graphics may use. */
function publicEventFields(event: EsEventRow) {
  if (!event || typeof event !== "object" || !("title" in event) || !("slug" in event)) {
    throw new Error("Promo graphics require a public event record");
  }
  return {
    title: event.title,
    institution: event.institution_name,
    category: esEventCategoryLabels[event.category] ?? "Event",
    format: ES_FORMAT_LABELS[event.format] ?? "Event",
    city: event.city,
    starts_at: event.starts_at,
    registration_closes_at: event.registration_closes_at,
    theme: event.theme,
    edition: event.edition,
  };
}

export function eventUrlFor(event: Pick<EsEventRow, "slug">): string {
  return `${window.location.origin}/eventspace/${event.slug}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

/** Escapes text into SVG <text> runs with simple word wrap at approx width. */
function wrappedLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function textBlock(lines: string[], x: number, y: number, size: number, fill: string, weight = "700", gap = 1.15): string {
  return lines
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * size * gap}" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(l)}</text>`
    )
    .join("");
}

/** Generates the SVG source for a promo card. Pure string building. */
export function buildPromoSvg(event: EsEventRow, size: PromoSize, qrDataUrl: string, logoUrl?: string | null): string {
  const e = publicEventFields(event);
  const { w, h } = PROMO_SIZES[size];
  const pad = Math.round(w * 0.07);
  const qrSize = Math.round(Math.min(w, h) * 0.16);
  const qrX = w - pad - qrSize;
  const qrY = h - pad - qrSize;

  const titleLines = wrappedLines(e.title, size === "story" ? 16 : size === "landscape" ? 24 : 17, size === "story" ? 5 : 4);
  const titleSize = size === "story" ? 76 : size === "landscape" ? 58 : 72;

  const dateLine = [
    fmtDate(e.starts_at),
    e.city ? `· ${e.city}` : "",
    e.format ? `· ${e.format}` : "",
  ]
    .filter(Boolean)
    .join("  ");
  const regLine = e.registration_closes_at
    ? `Registration closes ${fmtDate(e.registration_closes_at)}`
    : "Registration open now";

  const logoTag = logoUrl
    ? `<image href="${esc(logoUrl)}" x="${pad}" y="${pad}" width="${Math.round(w * 0.09)}" height="${Math.round(w * 0.09)}" preserveAspectRatio="xMidYMid meet" />`
    : "";

  const contentStartY = pad + Math.round(w * 0.09) + Math.round(h * 0.08);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#052520"/>
      <stop offset="55%" stop-color="#0b4638"/>
      <stop offset="100%" stop-color="#159875"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <circle cx="${w - Math.round(w * 0.12)}" cy="${Math.round(h * 0.16)}" r="${Math.round(w * 0.16)}" fill="#b3e75c" opacity="0.14"/>
  <circle cx="${Math.round(w * 0.08)}" cy="${Math.round(h * 0.86)}" r="${Math.round(w * 0.1)}" fill="#c7f36b" opacity="0.10"/>
  ${logoTag}
  <text x="${pad}" y="${contentStartY - Math.round(h * 0.02)}" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="${Math.round(w * 0.028)}" font-weight="800" letter-spacing="4" fill="#c7f36b">BUILDPROOF · ${esc(e.category.toUpperCase())}</text>
  ${textBlock(titleLines, pad, contentStartY + titleSize, titleSize, "#ffffff")}
  <text x="${pad}" y="${contentStartY + titleSize * (titleLines.length + 0.8)}" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="${Math.round(w * 0.03)}" font-weight="600" fill="#ddf2e8">${esc(dateLine)}</text>
  <text x="${pad}" y="${contentStartY + titleSize * (titleLines.length + 1.8)}" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="${Math.round(w * 0.03)}" font-weight="600" fill="#c7f36b">${esc(regLine)}</text>
  <text x="${pad}" y="${contentStartY + titleSize * (titleLines.length + 2.6)}" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="${Math.round(w * 0.026)}" font-weight="500" fill="#ddf2e8">${esc(e.institution)}${e.edition ? ` · ${esc(e.edition)}` : ""}</text>
  <rect x="${qrX - 12}" y="${qrY - 12}" width="${qrSize + 24}" height="${qrSize + 24}" rx="18" fill="#ffffff"/>
  <image href="${qrDataUrl}" x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"/>
  <text x="${pad}" y="${h - pad / 2}" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="${Math.round(w * 0.022)}" font-weight="600" fill="#ddf2e8">Scan to register · buildproof.app</text>
</svg>`;
}

export async function makeQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 512, color: { dark: "#052520", light: "#ffffff" } });
}

export function svgBlob(svg: string): Blob {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

/** Rasterises an SVG string to PNG via an offscreen canvas (same-document). */
export async function svgToPngBlob(svg: string, w: number, h: number): Promise<Blob> {
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not rasterise the graphic in this browser."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed."))), "image/png")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Convenience: builds + downloads one graphic in one call. */
export async function downloadPromoGraphic(
  event: EsEventRow,
  size: PromoSize,
  format: "svg" | "png",
  qrDataUrl: string
): Promise<void> {
  const { w, h } = PROMO_SIZES[size];
  const svg = buildPromoSvg(event, size, qrDataUrl, eventMediaUrl(event.logo_path));
  const base = `buildproof-${event.slug}-${size}`;
  if (format === "svg") {
    downloadBlob(svgBlob(svg), `${base}.svg`);
    return;
  }
  downloadBlob(await svgToPngBlob(svg, w, h), `${base}.png`);
}

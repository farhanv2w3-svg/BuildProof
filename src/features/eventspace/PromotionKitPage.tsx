import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  PageTitle,
  Select,
  Textarea,
} from "../../components/ui";
import { getEventById, eventMediaUrl } from "../../lib/eventspace";
import {
  CAPTION_TEMPLATE_KEYS,
  captionTemplateLabels,
  generateCaption,
  shareLinks,
  type CaptionTemplateKey,
} from "../../lib/eventspaceRules";
import {
  buildPromoSvg,
  downloadPromoGraphic,
  eventUrlFor,
  makeQrDataUrl,
  PROMO_SIZES,
  svgBlob,
  downloadBlob,
  type PromoSize,
} from "./promoGraphics";
import { errMessage } from "../../lib/api";

export default function PromotionKitPage() {
  const { eventId = "" } = useParams();
  const { data: event, isLoading, error } = useQuery({
    queryKey: ["es_event_by_id", eventId],
    queryFn: () => getEventById(eventId),
  });
  const [size, setSize] = useState<PromoSize>("square");
  const [qr, setQr] = useState<string | null>(null);
  const [captionKey, setCaptionKey] = useState<CaptionTemplateKey>("registration_open");
  const [captionOverride, setCaptionOverride] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string | null>(null);

  const url = event ? eventUrlFor(event) : "";

  const caption = useMemo(() => {
    if (!event) return "";
    if (captionOverride !== null) return captionOverride;
    return generateCaption(captionKey, {
      title: event.title,
      institution_name: event.institution_name,
      category: event.category,
      starts_at: event.starts_at,
      registration_closes_at: event.registration_closes_at,
      city: event.city,
      format: event.format,
      url,
    });
  }, [event, captionKey, captionOverride, url]);

  if (isLoading) return <LoadingBlock label="Loading promotion kit…" />;
  if (error) return <ErrorBanner message={errMessage(error)} />;
  if (!event) return <EmptyState title="Event not found" />;
  if (event.status === "draft") {
    return (
      <EmptyState
        title="Publish the event first"
        description="The promotion kit works with published events so graphics always show live, accurate details."
        action={
          <Link to={`/app/eventspace/${event.id}/edit`} className="no-underline">
            <Button>Continue editing</Button>
          </Link>
        }
      />
    );
  }

  const links = shareLinks(url, caption.split("\n")[0] ?? "");

  async function ensureQr(): Promise<string> {
    if (qr) return qr;
    const dataUrl = await makeQrDataUrl(url);
    setQr(dataUrl);
    return dataUrl;
  }

  async function generate() {
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await ensureQr();
      const svg = buildPromoSvg(event!, size, dataUrl, eventMediaUrl(event!.logo_path));
      const blobUrl = URL.createObjectURL(svgBlob(svg));
      setSvgPreviewUrl(blobUrl);
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function download(format: "svg" | "png") {
    setErr(null);
    setBusy(true);
    try {
      const dataUrl = await ensureQr();
      await downloadPromoGraphic(event!, size, format, dataUrl);
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setErr("Clipboard access was blocked by the browser.");
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Promotion kit"
        sub={`${event.title} · graphics, captions and share actions generated locally in your browser`}
        action={
          <Link to={`/app/eventspace/${event.id}/manage`} className="no-underline">
            <Button variant="secondary">Workspace</Button>
          </Link>
        }
      />

      {err ? <ErrorBanner message={err} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Shareable graphics" sub="Populated from the live event data. Your uploaded poster is never overwritten." />
          <div className="space-y-3 px-5 pb-5">
            <Field label="Format">
              <Select value={size} onChange={(e) => setSize(e.target.value as PromoSize)}>
                {Object.entries(PROMO_SIZES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} — {v.hint}</option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button loading={busy} onClick={generate}>Preview graphic</Button>
              <Button variant="secondary" loading={busy} onClick={() => download("png")}>Download PNG</Button>
              <Button variant="secondary" loading={busy} onClick={() => download("svg")}>Download SVG</Button>
            </div>
            {svgPreviewUrl ? (
              <div className="overflow-hidden rounded-xl border border-line">
                <img src={svgPreviewUrl} alt="Promo graphic preview" className="w-full" />
              </div>
            ) : (
              <p className="text-xs text-ink-soft">Preview renders locally — nothing is uploaded anywhere.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="QR code" sub="Points to this event's public page." />
          <div className="flex flex-wrap items-center gap-4 px-5 pb-5">
            {qr ? (
              <img src={qr} alt="Event QR code" className="h-40 w-40 rounded-xl border border-line" />
            ) : (
              <Button loading={busy} onClick={async () => { await ensureQr().catch((e) => setErr(errMessage(e))); }}>
                Generate QR
              </Button>
            )}
            {qr ? (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    fetch(qr)
                      .then((r) => r.blob())
                      .then((b) => downloadBlob(b, `buildproof-${event.slug}-qr.png`))
                      .catch((e) => setErr(errMessage(e)));
                  }}
                >
                  Download QR (PNG)
                </Button>
                <span className="max-w-48 break-all text-[11px] text-ink-soft">{url}</span>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Captions" sub="Editable templates with your event details already inserted." />
          <div className="space-y-3 px-5 pb-5">
            <Field label="Template">
              <Select
                value={captionKey}
                onChange={(e) => {
                  setCaptionKey(e.target.value as CaptionTemplateKey);
                  setCaptionOverride(null);
                }}
              >
                {CAPTION_TEMPLATE_KEYS.map((k) => (
                  <option key={k} value={k}>{captionTemplateLabels[k]}</option>
                ))}
              </Select>
            </Field>
            <Textarea
              rows={7}
              value={caption}
              onChange={(e) => setCaptionOverride(e.target.value)}
              aria-label="Caption text"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copy(caption, "caption")}>
                {copied === "caption" ? "Copied ✓" : "Copy caption"}
              </Button>
              {captionOverride !== null ? (
                <Button size="sm" variant="ghost" onClick={() => setCaptionOverride(null)}>Reset to template</Button>
              ) : null}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Share" sub="Direct links open each platform with your caption. No automatic publishing — you stay in control." />
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            <Button size="sm" variant="secondary" onClick={() => copy(url, "url")}>
              {copied === "url" ? "Link copied ✓" : "Copy event link"}
            </Button>
            <a className="no-underline" href={links.whatsapp} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="secondary">WhatsApp</Button>
            </a>
            <a className="no-underline" href={links.linkedin} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="secondary">LinkedIn</Button>
            </a>
            <a className="no-underline" href={links.x} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="secondary">X</Button>
            </a>
            {typeof navigator.share === "function" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.share({ title: event.title, text: caption.slice(0, 200), url });
                  } catch {
                    // user dismissed the native sheet
                  }
                }}
              >
                More options…
              </Button>
            ) : null}
          </div>
          <div className="mx-5 mb-5 rounded-xl border border-line bg-canvas px-4 py-3 text-xs text-ink-soft">
            <p className="font-bold text-ink">Instagram workflow (manual by design)</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Download the story or square graphic (PNG).</li>
              <li>Copy the caption above.</li>
              <li>Open Instagram and create the post yourself.</li>
            </ol>
            <p className="mt-2">
              <Badge tone="neutral">No automatic posting</Badge> BuildProof never requests social
              account passwords and never posts on your behalf.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Project promotion" sub="For approved public showcase entries, the same graphics and captions are generated from the showcase page using only owner-approved fields — private submission data can never appear in a promo graphic." />
      </Card>
    </div>
  );
}

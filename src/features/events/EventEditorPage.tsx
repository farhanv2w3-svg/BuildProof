import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, RotateCcw, CircleAlert } from "lucide-react";
import {
  Button, ButtonLink, Card, EmptyState, ErrorBanner, Field, Input, LoadingBlock,
  PageTitle, Select, SuccessBanner, Textarea, Badge,
} from "../../components/ui";
import {
  createEvent, updateEvent, uploadEventPoster, eventPosterPublicUrl,
  fetchEvent, errMessage, EVENT_POSTERS_BUCKET,
} from "../../lib/api";
import { getSupabase } from "../../lib/supabase";
import {
  MAX_EVENT_POSTER_SIZE_BYTES, ALLOWED_POSTER_EXTENSIONS,
  EVENT_TYPES, eventTypeLabels,
  validatePosterFile, posterMagicByteCheck, validateContactNumber,
  isValidRegistrationUrl, eventSchema, eventDurationLabel, formatEventDateRange,
} from "../../lib/eventsRules";
import { useAuth } from "../../lib/auth";
import type { EventRow, EventType, EventStatus } from "../../types/database";
import EventCard from "./EventCard";

/* ------------------------------------------------------------------ */
/*  Create + edit. One form, two modes (route decides).                */
/*  Poster validation: extension + declared MIME + real magic bytes +  */
/*  size — the storage bucket enforces the same limits server-side,    */
/*  so bypassing the form cannot sneak a huge or non-image file in.    */
/*  supabase-js uploads have no progress events, so publishing shows   */
/*  an honest busy state instead of a fake progress bar.               */
/* ------------------------------------------------------------------ */

const MB_LABEL = `${Math.round(MAX_EVENT_POSTER_SIZE_BYTES / (1024 * 1024))} MB`;

interface FormState {
  title: string;
  event_type: EventType;
  institution_name: string;
  city: string;
  state_name: string;
  start_date: string;
  end_date: string;
  contact_number: string;
  contact_name: string;
  registration_url: string;
  venue: string;
  description: string;
  schedule_note: string;
}

const emptyForm: FormState = {
  title: "",
  event_type: "hackathon",
  institution_name: "",
  city: "",
  state_name: "",
  start_date: "",
  end_date: "",
  contact_number: "",
  contact_name: "",
  registration_url: "",
  venue: "",
  description: "",
  schedule_note: "",
};

function formFromRow(ev: EventRow): FormState {
  return {
    title: ev.title,
    event_type: ev.event_type,
    institution_name: ev.institution_name,
    city: ev.city,
    state_name: ev.state_name,
    start_date: ev.start_date,
    end_date: ev.end_date,
    contact_number: ev.contact_number ?? "",
    contact_name: ev.contact_name ?? "",
    registration_url: ev.registration_url ?? "",
    venue: ev.venue ?? "",
    description: ev.description ?? "",
    schedule_note: ev.schedule_note ?? "",
  };
}

export default function EventEditorPage() {
  const { eventId } = useParams();
  const editing = eventId != null;

  if (editing) return <EditMode eventId={eventId} />;
  return (
    <div>
      <PageTitle
        title="Create an event"
        sub="Publish a college event under your own account. Anyone signed in can do this — the organizer identity shown on the event is your BuildProof account."
      />
      <EventForm eventId={null} initial={emptyForm} />
    </div>
  );
}

/* ------------------------------- edit mode ------------------------------ */

function EditMode({ eventId }: { eventId: string }) {
  const { user, loading } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["events", "detail", eventId],
    queryFn: () => fetchEvent(eventId),
  });

  if (loading || isLoading) return <LoadingBlock label="Loading event…" />;

  const ev = (data ?? null) as EventRow | null;
  const owns = ev != null && user != null && ev.created_by === user.id;

  const heading = (
    <PageTitle
      title="Edit event"
      sub="Update your event information or replace its poster. Changes go live as soon as you save."
      action={<ButtonLink to="/app/my-events" variant="secondary">Back to My events</ButtonLink>}
    />
  );

  if (error) {
    return (
      <div>
        {heading}
        <ErrorBanner message="The event could not be loaded. Check your connection and try again." />
      </div>
    );
  }
  if (!ev) {
    return (
      <div>
        {heading}
        <EmptyState
          title="Event not available"
          description="This event does not exist or you cannot see it with your account."
          action={<ButtonLink to="/app/my-events" variant="secondary">My events</ButtonLink>}
        />
      </div>
    );
  }
  if (!owns) {
    return (
      <div>
        {heading}
        <ErrorBanner message="You can only edit events that you created yourself." />
      </div>
    );
  }

  return (
    <div>
      {heading}
      <EventForm eventId={ev.id} initial={formFromRow(ev)} existingPosterPath={ev.poster_path} />
    </div>
  );
}

/* ------------------------------- the form ------------------------------- */

function EventForm({
  eventId,
  initial,
  existingPosterPath,
}: {
  eventId: string | null;
  initial: FormState;
  existingPosterPath?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [f, setF] = useState<FormState>(initial);
  const [status, setStatus] = useState<EventStatus>("published");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ eventId: string | null } | null>(null);

  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(
    existingPosterPath ? eventPosterPublicUrl(existingPosterPath) : null
  );
  const objectUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const durationLabel =
    f.start_date && f.end_date
      ? eventDurationLabel(f.start_date, f.end_date)
      : f.start_date ? "Pick an end date to calculate duration" : "";

  const onPosterChange = async (file: File | null) => {
    if (!file) return;
    const sizeErr = validatePosterFile(file);
    if (sizeErr) { setFieldErrors((e) => ({ ...e, poster: sizeErr })); return; }
    const magicErr = await posterMagicByteCheck(file);
    if (magicErr) { setFieldErrors((e) => ({ ...e, poster: magicErr })); return; }
    setFieldErrors((e) => ({ ...e, poster: undefined as unknown as string }));
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPosterFile(file);
    setPosterPreview(url);
  };

  const previewRow: EventRow = useMemo(
    () => ({
      id: eventId ?? "preview",
      created_by: "",
      title: f.title || "Your event title",
      event_type: f.event_type,
      institution_name: f.institution_name || "Organizing college name",
      city: f.city || "City",
      state_name: f.state_name || "State",
      start_date: f.start_date || "",
      end_date: f.end_date || f.start_date || "",
      poster_path: "",
      contact_number: f.contact_number || null,
      venue: f.venue || null,
      description: f.description || null,
      registration_url: f.registration_url || null,
      contact_name: f.contact_name || null,
      schedule_note: f.schedule_note || null,
      status,
      created_at: "",
      updated_at: "",
    }),
    [f, status, eventId]
  );
  const previewPoster = posterPreview;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    const errs: Record<string, string> = {};

    // Poster must exist (required in both modes).
    if (!posterFile && !existingPosterPath) errs.poster = "A poster image is required.";

    const parsed = eventSchema.safeParse({
      ...f,
      contact_number: f.contact_number || undefined,
      venue: f.venue || undefined,
      description: f.description || undefined,
      registration_url: f.registration_url || undefined,
      contact_name: f.contact_name || undefined,
      schedule_note: f.schedule_note || undefined,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!errs[key]) errs[key] = issue.message;
      }
    }
    const contactErr = validateContactNumber(f.contact_number);
    if (contactErr) errs.contact_number = contactErr;
    if (f.registration_url.trim() && !isValidRegistrationUrl(f.registration_url)) {
      errs.registration_url = "Enter a full link starting with http:// or https:// (javascript: and other unsafe schemes are not allowed).";
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setBanner("Please fix the highlighted fields before continuing.");
      return;
    }

    setBusy(true);
    try {
      let newPosterPath: string | null = null;
      if (posterFile && user) {
        newPosterPath = await uploadEventPoster(user.id, posterFile);
      }
      const values = {
        title: f.title.trim(),
        event_type: f.event_type,
        institution_name: f.institution_name.trim(),
        city: f.city.trim(),
        state_name: f.state_name.trim(),
        start_date: f.start_date,
        end_date: f.end_date,
        contact_number: f.contact_number.trim() || null,
        venue: f.venue.trim() || null,
        description: f.description.trim() || null,
        registration_url: f.registration_url.trim() || null,
        contact_name: f.contact_name.trim() || null,
        schedule_note: f.schedule_note.trim() || null,
        status,
        poster_path: newPosterPath ?? existingPosterPath!,
      };

      if (eventId == null) {
        const created = await createEvent(values, user!.id);
        await qc.invalidateQueries({ queryKey: ["events"] });
        setDone({ eventId: created.id });
      } else {
        await updateEvent(eventId, values);
        if (newPosterPath && existingPosterPath) {
          // Best-effort cleanup of the replaced poster (own folder only).
          await deleteReplacedPoster(existingPosterPath).catch(() => undefined);
        }
        await qc.invalidateQueries({ queryKey: ["events"] });
        setDone({ eventId });
      }
    } catch (err) {
      setBanner(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div>
        <SuccessBanner message={eventId == null ? "Event published. It is now visible on the Events page." : "Changes saved."} />
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink to={`/app/events/${done.eventId}`}>View event details</ButtonLink>
          <ButtonLink to="/app/my-events" variant="secondary">My events</ButtonLink>
          <Button variant="ghost" onClick={() => { setDone(null); if (eventId == null) setF(emptyForm); }}>
            {eventId == null ? "Create another event" : "Edit again"}
          </Button>
        </div>
      </div>
    );
  }

  const sectionTitle = (n: number, text: string) => (
    <h2 className="col-span-full mt-1 text-[13px] font-bold uppercase tracking-[0.14em] text-brand-700">
      {n}. {text}
    </h2>
  );

  return (
    <form onSubmit={submit} noValidate>
      {banner && <div className="mb-4"><ErrorBanner message={banner} /></div>}
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        {/* 1. Event information */}
        {sectionTitle(1, "Event information")}
        <div className="sm:col-span-2">
          <Field label="Event title" required error={fieldErrors.title} hint="Example: National Student Innovation Hackathon 2027">
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} />
          </Field>
        </div>
        <Field label="Event type" required error={fieldErrors.event_type}>
          <Select value={f.event_type} onChange={(e) => setF({ ...f, event_type: e.target.value as EventType })}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{eventTypeLabels[t]}</option>)}
          </Select>
        </Field>

        {/* 2. College and location */}
        {sectionTitle(2, "College and location")}
        <div className="sm:col-span-2">
          <Field
            label="Organizing college / institution"
            required
            error={fieldErrors.institution_name}
            hint={`Enter the full official name. It is organizer-provided and shown as “not verified” to students. Your BuildProof account name is the publisher.`}
          >
            <Input value={f.institution_name} onChange={(e) => setF({ ...f, institution_name: e.target.value })} maxLength={200} />
          </Field>
        </div>
        <Field label="City" required error={fieldErrors.city}>
          <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} maxLength={120} />
        </Field>
        <Field label="State / union territory" required error={fieldErrors.state_name}>
          <Input value={f.state_name} onChange={(e) => setF({ ...f, state_name: e.target.value })} maxLength={120} />
        </Field>

        {/* 3. Dates & duration */}
        {sectionTitle(3, "Dates and duration")}
        <Field label="Start date" required error={fieldErrors.start_date}>
          <Input
            type="date"
            value={f.start_date}
            onChange={(e) => setF({ ...f, start_date: e.target.value })}
            aria-label="Event start date"
          />
        </Field>
        <Field
          label="End date"
          required
          error={fieldErrors.end_date ?? (f.start_date && f.end_date && f.end_date < f.start_date ? "The end date cannot be before the start date." : undefined)}
          hint="For a one-day event, use the same date as the start date."
        >
          <Input
            type="date"
            value={f.end_date}
            min={f.start_date || undefined}
            onChange={(e) => setF({ ...f, end_date: e.target.value })}
            aria-label="Event end date"
          />
        </Field>
        <p className="sm:col-span-2 text-[13px] text-ink" aria-live="polite">
          {durationLabel && (
            <span className="font-semibold text-brand-700">
              Duration: {durationLabel}
              {f.start_date && f.end_date && ` — ${formatEventDateRange(f.start_date, f.end_date)}`}
            </span>
          )}
        </p>

        {/* 4. Poster */}
        {sectionTitle(4, "Poster")}
        <div className="sm:col-span-2">
          <p className="mb-2 rounded-lg bg-canvas px-3 py-2 text-[12.5px] text-ink-soft" role="note">
            Required. JPEG, PNG or WebP ({ALLOWED_POSTER_EXTENSIONS.join(", ")} files) · at most {MB_LABEL}. The same limit is enforced by the poster storage service itself.
          </p>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div>
              <Field
                label={existingPosterPath && !posterFile ? "Replace poster (optional)" : "Poster image"}
                required={!existingPosterPath}
                error={fieldErrors.poster}
              >
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-[13px] font-semibold text-brand-700 hover:bg-brand-100">
                  <ImageUp className="h-4 w-4" aria-hidden />
                  {posterFile ? "Change selected image" : existingPosterPath ? "Choose a replacement image" : "Choose a poster image"}
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => onPosterChange(e.target.files?.[0] ?? null)}
                    aria-label="Poster image file"
                  />
                </label>
              </Field>
              {posterFile && (
                <p className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-ink-soft">
                  <span className="break-all">{posterFile.name} · {(posterFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                    onClick={() => {
                      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                      objectUrlRef.current = null;
                      setPosterFile(null);
                      setPosterPreview(existingPosterPath ? eventPosterPublicUrl(existingPosterPath) : null);
                    }}
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden /> Reset
                  </button>
                </p>
              )}
            </div>
            <div className="flex h-48 items-center justify-center rounded-lg border border-line bg-canvas p-2" aria-label="Poster preview">
              {posterPreview ? (
                <img src={posterPreview} alt="Selected poster preview" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[12.5px] text-ink-soft">Preview appears here</span>
              )}
            </div>
          </div>
        </div>

        {/* 5. Optional details */}
        {sectionTitle(5, "Optional contact and additional details")}
        <Field label="Contact number" error={fieldErrors.contact_number} hint="Optional — leave empty if the poster already shows it.">
          <Input
            value={f.contact_number}
            onChange={(e) => setF({ ...f, contact_number: e.target.value })}
            maxLength={20}
            placeholder="e.g. +91 98765 43210 or a department landline"
          />
        </Field>
        <Field label="Organizer contact name or department" error={fieldErrors.contact_name}>
          <Input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} maxLength={120} placeholder="e.g. Student Affairs Office" />
        </Field>
        <Field label="Official registration / info link" error={fieldErrors.registration_url} hint="Must start with http:// or https:// — unsafe schemes are rejected.">
          <Input value={f.registration_url} onChange={(e) => setF({ ...f, registration_url: e.target.value })} maxLength={400} placeholder="https://college.edu/event" />
        </Field>
        <Field label="Venue" error={fieldErrors.venue}>
          <Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} maxLength={240} placeholder="e.g. Main auditorium" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Short description" error={fieldErrors.description}>
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={3000} rows={4} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Schedule or additional information" error={fieldErrors.schedule_note}>
            <Textarea value={f.schedule_note} onChange={(e) => setF({ ...f, schedule_note: e.target.value })} maxLength={3000} rows={3} placeholder="Timings, registration deadlines, eligibility…" />
          </Field>
        </div>

        {/* 6. Preview & publish */}
        {sectionTitle(6, "Preview and publish")}
        <div className="sm:col-span-2">
          <Badge tone="neutral">Live preview</Badge>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            <EventCard ev={previewRow} posterUrl={previewPoster} />
            <div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-[13px] font-semibold text-ink">Choose how to save</legend>
                {([
                  ["published", "Publish now — publicly visible to everyone"],
                  ["draft", "Save as draft — only you can see it"],
                ] as [EventStatus, string][]).map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] has-checked:border-brand-400 has-checked:bg-brand-50">
                    <input
                      type="radio"
                      name="event-status"
                      value={value}
                      checked={status === value}
                      onChange={() => setStatus(value)}
                      className="accent-brand-600"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <p className="mt-2 flex items-start gap-1.5 text-[12px] text-ink-soft">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {eventId == null && status !== "published"
                  ? "A draft must still include a poster. Publish it later from My events."
                  : `You are ${eventId == null ? "creating" : "editing"} this event under your own account. College names are organizer-provided and shown unverified.`}
              </p>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button type="submit" loading={busy} size="lg">
            {busy
              ? "Uploading and saving…"
              : eventId == null
                ? status === "published" ? "Publish event" : "Save draft"
                : "Save changes"}
          </Button>
          <ButtonLink to={eventId == null ? "/app/events" : "/app/my-events"} variant="ghost">Cancel</ButtonLink>
          {eventId != null && (
            <Link to={`/app/events/${eventId}`} className="text-[13px] font-semibold text-brand-700 hover:underline">
              View public page
            </Link>
          )}
        </div>
      </Card>
    </form>
  );
}

/** Removes the replaced poster object. Folder-scoped storage policy makes it
 * impossible for this to touch another organizer's file. */
async function deleteReplacedPoster(path: string): Promise<void> {
  const s = getSupabase();
  if (!s) return;
  await s.storage.from(EVENT_POSTERS_BUCKET).remove([path]);
}

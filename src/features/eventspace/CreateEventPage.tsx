import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardHeader,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  PageTitle,
  Select,
  Textarea,
  Badge,
} from "../../components/ui";
import {
  createEventDraft,
  getEventById,
  updateEvent,
  uploadEventMedia,
  listRounds,
  upsertRound,
  deleteRound,
  listAwards,
  upsertAward,
  deleteAward,
} from "../../lib/eventspace";
import {
  ES_EVENT_CATEGORIES,
  ES_SUBMISSION_FIELD_KEYS,
  ES_SUBMISSION_FIELD_LABELS,
  isValidEventSlug,
  slugify,
  validateCriteriaWeights,
  validateEventDates,
  validateSubmissionFieldConfig,
  validateTeamSizeConfig,
} from "../../lib/eventspaceRules";
import { errMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatDate } from "../../lib/utils";
import type { EsCriterion, EsEventRow, EsRegQuestion, EsSubmissionField } from "../../types/database";
import { getMyOrganizerApplication } from "../../lib/eventspace";

/* ------------------------------------------------------------------ */
/*  Create/Edit event wizard. Draft-first: every section autosaves to  */
/*  the server as a draft; publishing runs the checklist validation.   */
/* ------------------------------------------------------------------ */

type Draft = Partial<EsEventRow> & {
  title: string;
  category: EsEventRow["category"];
  institution_name: string;
};

const SECTIONS = ["Identity", "Format", "Dates", "Eligibility", "Registration", "Rules", "Rounds", "Submission config", "Evaluation", "Awards", "Visibility"] as const;

function emptyDraft(userId: string | undefined): Draft {
  return {
    title: "",
    category: "hackathon",
    short_description: "",
    full_description: "",
    institution_name: "",
    edition: "",
    theme: "",
    format: "online",
    timezone: "Asia/Kolkata",
    participation: "both",
    min_team_size: 2,
    max_team_size: 4,
    registration_enabled: true,
    registration_open: true,
    submission_open: true,
    evaluation_enabled: true,
    evaluation_criteria: [
      { name: "Problem understanding", weight: 20 },
      { name: "Solution & innovation", weight: 30 },
      { name: "Execution & prototype", weight: 30 },
      { name: "Impact", weight: 20 },
    ],
    submission_fields: [
      { key: "title", label: "Project title", required: true },
      { key: "problem", label: "Problem statement", required: true },
      { key: "solution", label: "Proposed solution", required: true },
      { key: "demo_url", label: "Demo link", required: false },
    ],
    visibility: "public",
    starts_at: "",
    ends_at: "",
    created_by: userId,
  };
}

export default function CreateEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: organizerApp } = useQuery({
    queryKey: ["es_my_organizer_app"],
    queryFn: getMyOrganizerApplication,
  });
  const approved = organizerApp?.status === "approved";

  const { data: existing, isLoading } = useQuery({
    queryKey: ["es_event_by_id", eventId],
    queryFn: () => getEventById(eventId!),
    enabled: !!eventId,
  });

  const [draft, setDraft] = useState<Draft>(emptyDraft(user?.id));
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Identity");

  useEffect(() => {
    if (existing) setDraft(existing as Draft);
  }, [existing]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const dateCheck = useMemo(
    () =>
      validateEventDates({
        starts_at: draft.starts_at ?? "",
        ends_at: draft.ends_at ?? "",
        registration_opens_at: draft.registration_opens_at,
        registration_closes_at: draft.registration_closes_at,
        submission_opens_at: draft.submission_opens_at,
        submission_deadline: draft.submission_deadline,
        judging_starts_at: draft.judging_starts_at,
        judging_ends_at: draft.judging_ends_at,
        results_at: draft.results_at,
      }),
    [draft]
  );
  const weightsCheck = useMemo(
    () => validateCriteriaWeights((draft.evaluation_criteria ?? []) as EsCriterion[]),
    [draft.evaluation_criteria]
  );
  const teamCheck = useMemo(
    () => validateTeamSizeConfig(draft.participation ?? "both", draft.min_team_size ?? 2, draft.max_team_size ?? 4),
    [draft.participation, draft.min_team_size, draft.max_team_size]
  );
  const fieldsCheck = useMemo(
    () => validateSubmissionFieldConfig((draft.submission_fields ?? []) as EsSubmissionField[]),
    [draft.submission_fields]
  );

  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(eventId ?? null);

  const saveDraft = useCallback(
    async (publish = false) => {
      setError(null);
      try {
        setSavingDraft(true);
        if (publish) {
          if (dateCheck.ok === false) throw new Error(dateCheck.message!);
          if (weightsCheck.ok === false) throw new Error(weightsCheck.message!);
          if (teamCheck.ok === false) throw new Error(teamCheck.message!);
          if (fieldsCheck.ok === false) throw new Error(fieldsCheck.message!);
          if (!draft.starts_at || !draft.ends_at) throw new Error("Event start and end dates are required.");
        }
        const payload = { ...draft, created_by: undefined };
        delete (payload as Record<string, unknown>).created_by;
        if (draftId) {
          const updated = await updateEvent(draftId, { ...payload, ...(publish ? { status: "published" } : {}) });
          setDraftId(updated.id);
          if (publish) navigate(`/app/eventspace/${updated.id}/manage`);
        } else {
          const created = await createEventDraft({ ...payload, ...(publish ? { status: "published" } : {}) } as never);
          setDraftId(created.id);
          if (publish) navigate(`/app/eventspace/${created.id}/manage`);
          else navigate(`/app/eventspace/${created.id}/edit`, { replace: true });
        }
        return true;
      } catch (e) {
        setError(errMessage(e));
        return false;
      } finally {
        setSavingDraft(false);
      }
    },
    [draft, draftId, dateCheck, weightsCheck, teamCheck, fieldsCheck, navigate]
  );

  if (eventId && isLoading) return <LoadingBlock />;
  if (eventId && existing && existing.status !== "draft") {
    return (
      <div className="space-y-4">
        <ErrorBanner message="Only drafts can be edited here. Open the event's workspace to manage a published event." />
        <Link to={`/app/eventspace/${eventId}/manage`} className="no-underline">
          <Button>Open workspace</Button>
        </Link>
      </div>
    );
  }
  if (!approved) {
    return (
      <div className="space-y-4">
        <PageTitle title="Create event" />
        <ErrorBanner message="Organiser access is required to create events. Apply from the EventSpace organiser page — administrators verify every application." />
        <Link to="/eventspace/organizer" className="no-underline">
          <Button>Organiser application</Button>
        </Link>
      </div>
    );
  }

  const publishReadiness = [
    { ok: draft.title.trim().length >= 6, label: "Title (6+ characters)" },
    { ok: (draft.short_description ?? "").trim().length >= 20, label: "Short description (20+ characters)" },
    { ok: draft.institution_name.trim().length >= 2, label: "Institution / organisation" },
    { ok: !!draft.starts_at && !!draft.ends_at, label: "Start & end dates" },
    { ok: dateCheck.ok, label: "Date logic" },
    { ok: !draft.evaluation_enabled || weightsCheck.ok, label: "Evaluation weights total 100" },
    { ok: teamCheck.ok, label: "Team size configuration" },
    { ok: fieldsCheck.ok, label: "Submission field configuration" },
    {
      ok: draft.format === "online" || !!draft.venue,
      label: "Venue (required for offline/hybrid)",
    },
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        title={eventId ? "Edit event draft" : "Create event"}
        sub="Drafts autosave section-by-section; publish only when the checklist is complete."
        action={
          <Link to="/eventspace/organizer" className="no-underline">
            <Button variant="ghost">My events</Button>
          </Link>
        }
      />

      <nav className="flex flex-wrap gap-1.5" aria-label="Wizard sections">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${section === s ? "bg-brand-600 text-white" : "border border-line text-ink hover:border-brand-300"}`}
          >
            {s}
          </button>
        ))}
      </nav>

      {error ? <ErrorBanner message={error} /> : null}

      {section === "Identity" ? <IdentitySection draft={draft} set={set} /> : null}
      {section === "Format" ? <FormatSection draft={draft} set={set} /> : null}
      {section === "Dates" ? (
        <DatesSection draft={draft} set={set} dateCheck={dateCheck} />
      ) : null}
      {section === "Eligibility" ? <EligibilitySection draft={draft} set={set} /> : null}
      {section === "Registration" ? <RegistrationSection draft={draft} set={set} /> : null}
      {section === "Rules" ? <RulesSection draft={draft} set={set} /> : null}
      {section === "Rounds" ? <RoundsSection eventId={draftId} /> : null}
      {section === "Submission config" ? (
        <SubmissionConfigSection draft={draft} set={set} fieldsCheck={fieldsCheck} />
      ) : null}
      {section === "Evaluation" ? (
        <EvaluationSection draft={draft} set={set} weightsCheck={weightsCheck} />
      ) : null}
      {section === "Awards" ? <AwardsSection eventId={draftId} /> : null}
      {section === "Visibility" ? <VisibilitySection draft={draft} set={set} /> : null}

      <Card>
        <CardHeader title="Publication checklist" sub="All items must pass before publishing." />
        <ul className="space-y-1 px-5 pb-4 text-sm">
          {publishReadiness.map((c) => (
            <li key={c.label} className={c.ok ? "text-brand-700" : "text-ink-soft"}>
              {c.ok ? "✓" : "○"} {c.label}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          <Button variant="secondary" loading={savingDraft} onClick={() => saveDraft(false)}>
            {draftId ? "Save draft" : "Create draft"}
          </Button>
          <Button
            disabled={publishReadiness.some((c) => !c.ok)}
            loading={savingDraft}
            onClick={() => saveDraft(true)}
          >
            Publish event
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ sections --------------------------- */

type SectionProps = {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
};

function IdentitySection({ draft, set }: SectionProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const slug = draft.slug || (draft.title ? slugify(draft.title) : "");
  return (
    <Card>
      <CardHeader title="Event identity" />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Event title" required hint="6–180 characters.">
            <Input value={draft.title} maxLength={180} onChange={(e) => set("title", e.target.value)} />
          </Field>
        </div>
        <Field label="Category" required>
          <Select value={draft.category} onChange={(e) => set("category", e.target.value as EsEventRow["category"])}>
            {ES_EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
        <Field label="Institution / organisation" required>
          <Input value={draft.institution_name} maxLength={200} onChange={(e) => set("institution_name", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Short description" required hint="20–400 characters, shown on cards.">
            <Textarea rows={2} value={draft.short_description ?? ""} maxLength={400} onChange={(e) => set("short_description", e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Full description" hint="Supports blank-line paragraphs.">
            <Textarea rows={6} value={draft.full_description ?? ""} maxLength={12000} onChange={(e) => set("full_description", e.target.value)} />
          </Field>
        </div>
        <Field label="Edition" hint='e.g. "2026 edition"'>
          <Input value={draft.edition ?? ""} maxLength={80} onChange={(e) => set("edition", e.target.value)} />
        </Field>
        <Field label="Theme">
          <Input value={draft.theme ?? ""} maxLength={200} onChange={(e) => set("theme", e.target.value)} />
        </Field>
        <Field label="Official website (optional)">
          <Input type="url" value={draft.official_url ?? ""} onChange={(e) => set("official_url", e.target.value)} />
        </Field>
        <Field label="Event URL slug" hint={`buildproof.app/eventspace/${slug || "your-event"}`}>
          <Input value={draft.slug ?? ""} placeholder={slug} onChange={(e) => set("slug", slugify(e.target.value))} />
          {!isValidEventSlug(draft.slug || slug) && draft.slug ? (
            <p className="mt-1 text-xs text-accent-700">Slug is not URL-safe.</p>
          ) : null}
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Cover image"
            hint="JPEG/PNG/WebP, max 5 MB. Uploaded to your own folder in the public event media bucket."
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-sm"
              disabled={uploading || !user}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user) return;
                setUploadErr(null);
                setUploading(true);
                try {
                  const path = await uploadEventMedia(user.id, file, "cover");
                  set("cover_path", path);
                } catch (err) {
                  setUploadErr(errMessage(err));
                } finally {
                  setUploading(false);
                }
              }}
            />
          </Field>
          {uploadErr ? <ErrorBanner message={uploadErr} /> : null}
          {draft.cover_path ? <Badge tone="success">Cover uploaded</Badge> : null}
        </div>
      </div>
    </Card>
  );
}

function FormatSection({ draft, set }: SectionProps) {
  return (
    <Card>
      <CardHeader title="Format & location" />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <Field label="Format" required>
          <Select value={draft.format} onChange={(e) => set("format", e.target.value as EsEventRow["format"])}>
            <option value="online">Online</option>
            <option value="offline">In person</option>
            <option value="hybrid">Hybrid</option>
          </Select>
        </Field>
        <Field label="Timezone">
          <Input value={draft.timezone ?? "Asia/Kolkata"} maxLength={64} onChange={(e) => set("timezone", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Venue" hint="Required for offline/hybrid.">
            <Input value={draft.venue ?? ""} maxLength={240} onChange={(e) => set("venue", e.target.value)} />
          </Field>
        </div>
        <Field label="City">
          <Input value={draft.city ?? ""} maxLength={120} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="State">
          <Input value={draft.state_name ?? ""} maxLength={120} onChange={(e) => set("state_name", e.target.value)} />
        </Field>
        <Field label="Country">
          <Input value={draft.country ?? ""} maxLength={120} onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field label="Map link (optional)">
          <Input type="url" value={draft.map_url ?? ""} onChange={(e) => set("map_url", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Online participation instructions" hint="Visible to participants. Never paste private meeting links here — share them via announcements or email.">
            <Textarea rows={3} value={draft.online_instructions ?? ""} maxLength={3000} onChange={(e) => set("online_instructions", e.target.value)} />
          </Field>
        </div>
      </div>
    </Card>
  );
}

function DatesSection({
  draft,
  set,
  dateCheck,
}: SectionProps & { dateCheck: { ok: boolean; message: string | null } }) {
  const dateField = (label: string, key: keyof Draft, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input
        type="datetime-local"
        value={(draft[key] as string) ?? ""}
        onChange={(e) => set(key, e.target.value as never)}
      />
    </Field>
  );
  return (
    <Card>
      <CardHeader title="Dates & schedule" sub="Stored as timestamps; validated for logical order." />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        {dateField("Event starts", "starts_at")}
        {dateField("Event ends", "ends_at")}
        {dateField("Registration opens", "registration_opens_at")}
        {dateField("Registration closes", "registration_closes_at")}
        {dateField("Submission opens", "submission_opens_at")}
        {dateField("Submission deadline", "submission_deadline")}
        {dateField("Judging starts", "judging_starts_at")}
        {dateField("Judging ends", "judging_ends_at")}
        {dateField("Results announcement", "results_at")}
      </div>
      {!dateCheck.ok ? <ErrorBanner message={dateCheck.message ?? ""} /> : null}
    </Card>
  );
}

function EligibilitySection({ draft, set }: SectionProps) {
  const csv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <Card>
      <CardHeader title="Eligibility" sub="Leave a field empty to keep it open to all." />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <Field label="Participation" required>
          <Select value={draft.participation} onChange={(e) => set("participation", e.target.value as EsEventRow["participation"])}>
            <option value="individual">Individual only</option>
            <option value="team">Team only</option>
            <option value="both">Individual or team</option>
          </Select>
        </Field>
        <div className="flex items-end gap-3">
          <Field label="Min team size">
            <Input
              type="number"
              min={1}
              max={20}
              value={draft.min_team_size ?? 2}
              onChange={(e) => set("min_team_size", Number(e.target.value))}
            />
          </Field>
          <Field label="Max team size">
            <Input
              type="number"
              min={1}
              max={20}
              value={draft.max_team_size ?? 4}
              onChange={(e) => set("max_team_size", Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Eligible levels" hint="Comma-separated: school, college, university, open">
          <Input
            value={(draft.eligibility_levels ?? []).join(", ")}
            onChange={(e) => set("eligibility_levels", csv(e.target.value))}
          />
        </Field>
        <Field label="Eligible academic years" hint="Comma-separated">
          <Input
            value={(draft.eligibility_years ?? []).join(", ")}
            onChange={(e) => set("eligibility_years", csv(e.target.value))}
          />
        </Field>
        <Field label="Eligible departments" hint="Comma-separated">
          <Input
            value={(draft.eligibility_departments ?? []).join(", ")}
            onChange={(e) => set("eligibility_departments", csv(e.target.value))}
          />
        </Field>
        <Field label="Eligible institutions" hint="Comma-separated">
          <Input
            value={(draft.eligibility_institutions ?? []).join(", ")}
            onChange={(e) => set("eligibility_institutions", csv(e.target.value))}
          />
        </Field>
        <Field label="Eligible regions" hint="Comma-separated">
          <Input
            value={(draft.eligibility_regions ?? []).join(", ")}
            onChange={(e) => set("eligibility_regions", csv(e.target.value))}
          />
        </Field>
        <Field label="Age note (optional)" hint="Describe any age expectation honestly — this is informational only.">
          <Input value={draft.age_note ?? ""} maxLength={300} onChange={(e) => set("age_note", e.target.value)} />
        </Field>
      </div>
      <p className="px-5 pb-5 text-xs text-ink-soft">
        Note: BuildProof does not implement verified parental consent. If your event involves minors,
        state clearly in the rules how consent is handled and do not collect unnecessary personal data.
      </p>
    </Card>
  );
}

function RegistrationSection({ draft, set }: SectionProps) {
  const questions = (draft.reg_questions ?? []) as EsRegQuestion[];
  return (
    <Card>
      <CardHeader title="Registration settings" />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={draft.registration_enabled ?? true} onChange={(e) => set("registration_enabled", e.target.checked)} />
          Enable registration
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={draft.registration_open ?? true} onChange={(e) => set("registration_open", e.target.checked)} />
          Registration window open
        </label>
        <Field label="Registration capacity (optional)">
          <Input
            type="number"
            min={1}
            value={draft.registration_capacity ?? ""}
            onChange={(e) => set("registration_capacity", e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={draft.registration_approval ?? false} onChange={(e) => set("registration_approval", e.target.checked)} />
          Approve registrations manually
        </label>
        <div className="sm:col-span-2">
          <Field label="Registration instructions">
            <Textarea rows={2} value={draft.registration_note ?? ""} maxLength={3000} onChange={(e) => set("registration_note", e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Confirmation message">
            <Textarea rows={2} value={draft.confirmation_message ?? ""} maxLength={2000} onChange={(e) => set("confirmation_message", e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <CardHeader title="Registration questions" sub={`Up to 10 · ${questions.length} configured`} />
          {questions.map((q, i) => (
            <div key={i} className="mb-3 grid gap-2 sm:grid-cols-6">
              <Input
                className="sm:col-span-3"
                placeholder="Question label"
                value={q.label}
                onChange={(e) => {
                  const next = [...questions];
                  next[i] = { ...q, label: e.target.value };
                  set("reg_questions", next);
                }}
              />
              <Select
                value={q.type}
                className="sm:col-span-1"
                onChange={(e) => {
                  const next = [...questions];
                  next[i] = { ...q, type: e.target.value as EsRegQuestion["type"] };
                  set("reg_questions", next);
                }}
              >
                <option value="text">Text</option>
                <option value="textarea">Long text</option>
                <option value="select">Choice</option>
              </Select>
              <label className="flex items-center justify-center gap-1 text-xs text-ink-soft sm:col-span-1">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => {
                    const next = [...questions];
                    next[i] = { ...q, required: e.target.checked };
                    set("reg_questions", next);
                  }}
                />
                Required
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => set("reg_questions", questions.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          {questions.length < 10 ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => set("reg_questions", [...questions, { label: "", type: "text" as const, required: false }])}
            >
              Add question
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function RulesSection({ draft, set }: SectionProps) {
  return (
    <Card>
      <CardHeader title="Rules & instructions" />
      <div className="grid gap-4 px-5 pb-5">
        <Field label="Event rules">
          <Textarea rows={5} value={draft.rules ?? ""} maxLength={12000} onChange={(e) => set("rules", e.target.value)} />
        </Field>
        <Field label="Submission requirements">
          <Textarea rows={3} value={draft.submission_requirements ?? ""} maxLength={8000} onChange={(e) => set("submission_requirements", e.target.value)} />
        </Field>
        <Field label="Originality declaration terms">
          <Textarea rows={2} value={draft.originality_terms ?? ""} maxLength={4000} onChange={(e) => set("originality_terms", e.target.value)} />
        </Field>
        <Field label="Intellectual-property terms">
          <Textarea rows={2} value={draft.ip_terms ?? ""} maxLength={4000} onChange={(e) => set("ip_terms", e.target.value)} />
        </Field>
        <Field label="Late submission conditions">
          <Textarea rows={2} value={draft.late_submission_terms ?? ""} maxLength={2000} onChange={(e) => set("late_submission_terms", e.target.value)} />
        </Field>
        <Field label="Disqualification conditions">
          <Textarea rows={2} value={draft.disqualification_terms ?? ""} maxLength={2000} onChange={(e) => set("disqualification_terms", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Contact name">
            <Input value={draft.contact_name ?? ""} maxLength={120} onChange={(e) => set("contact_name", e.target.value)} />
          </Field>
          <Field label="Contact email">
            <Input type="email" value={draft.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} />
          </Field>
          <Field label="Contact phone">
            <Input value={draft.contact_phone ?? ""} maxLength={20} onChange={(e) => set("contact_phone", e.target.value)} />
          </Field>
        </div>
      </div>
    </Card>
  );
}

function SubmissionConfigSection({
  draft,
  set,
  fieldsCheck,
}: SectionProps & { fieldsCheck: { ok: boolean; message: string | null } }) {
  const configured = (draft.submission_fields ?? []) as EsSubmissionField[];
  return (
    <Card>
      <CardHeader
        title="Submission configuration"
        sub="Choose which supported fields participants must fill. Only whitelisted text/link fields are available — no arbitrary HTML."
      />
      <ul className="space-y-2 px-5 pb-4">
        {ES_SUBMISSION_FIELD_KEYS.map((key) => {
          const row = configured.find((f) => f.key === key);
          return (
            <li key={key} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
              <span className="text-sm font-semibold text-ink">{ES_SUBMISSION_FIELD_LABELS[key]}</span>
              <div className="flex items-center gap-4 text-xs font-semibold text-ink-soft">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={!!row}
                    onChange={(e) => {
                      if (e.target.checked) {
                        set("submission_fields", [...configured, { key, label: ES_SUBMISSION_FIELD_LABELS[key], required: false }]);
                      } else {
                        set("submission_fields", configured.filter((f) => f.key !== key));
                      }
                    }}
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    disabled={!row}
                    checked={row?.required ?? false}
                    onChange={(e) => {
                      set(
                        "submission_fields",
                        configured.map((f) => (f.key === key ? { ...f, required: e.target.checked } : f))
                      );
                    }}
                  />
                  Required
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      {!fieldsCheck.ok ? <ErrorBanner message={fieldsCheck.message ?? ""} /> : null}
    </Card>
  );
}

function EvaluationSection({
  draft,
  set,
  weightsCheck,
}: SectionProps & { weightsCheck: { ok: boolean; message: string | null } }) {
  const criteria = (draft.evaluation_criteria ?? []) as EsCriterion[];
  return (
    <Card>
      <CardHeader title="Evaluation" sub="Weights must total exactly 100. Judges score each criterion 0–10; the server computes weighted totals." />
      <label className="mx-5 mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={draft.evaluation_enabled ?? true} onChange={(e) => set("evaluation_enabled", e.target.checked)} />
        Enable evaluation & judging
      </label>
      {criteria.map((c, i) => (
        <div key={i} className="mx-5 mb-2 grid gap-2 sm:grid-cols-6">
          <Input
            className="sm:col-span-3"
            placeholder="Criterion name"
            value={c.name}
            onChange={(e) => {
              const next = [...criteria];
              next[i] = { ...c, name: e.target.value };
              set("evaluation_criteria", next);
            }}
          />
          <Input
            className="sm:col-span-1"
            type="number"
            min={1}
            max={100}
            value={c.weight}
            aria-label="Weight"
            onChange={(e) => {
              const next = [...criteria];
              next[i] = { ...c, weight: Number(e.target.value) };
              set("evaluation_criteria", next);
            }}
          />
          <Input
            className="sm:col-span-1"
            placeholder="Description (optional)"
            value={c.description ?? ""}
            onChange={(e) => {
              const next = [...criteria];
              next[i] = { ...c, description: e.target.value };
              set("evaluation_criteria", next);
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => set("evaluation_criteria", criteria.filter((_, j) => j !== i))}>
            Remove
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-3 px-5 pb-4">
        <Button size="sm" variant="secondary" onClick={() => set("evaluation_criteria", [...criteria, { name: "", weight: 10 }])}>
          Add criterion
        </Button>
        <Badge tone={weightsCheck.ok ? "success" : "warning"}>
          Total weight: {criteria.reduce((s, c) => s + (c.weight || 0), 0)}
        </Badge>
      </div>
      {!weightsCheck.ok ? <p className="px-5 pb-5 text-xs text-accent-700">{weightsCheck.message}</p> : null}
      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={draft.feedback_visible ?? false} onChange={(e) => set("feedback_visible", e.target.checked)} />
          Show judge feedback to participants
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={draft.anonymous_judging ?? false} onChange={(e) => set("anonymous_judging", e.target.checked)} />
          Hide judge names from participants
        </label>
      </div>
    </Card>
  );
}

function RoundsSection({ eventId }: { eventId: string | null }) {
  const { data: rounds, refetch } = useQuery({
    queryKey: ["es_rounds", eventId],
    queryFn: () => listRounds(eventId!),
    enabled: !!eventId,
  });
  if (!eventId) {
    return (
      <Card>
        <CardHeader title="Rounds" sub="Save the draft first to configure rounds." />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Rounds" sub="Default: a single submission round. Add more for multi-stage events." />
      <RoundEditor eventId={eventId} onSave={refetch} />
      <div className="space-y-2 px-5 pb-5">
        {(rounds ?? []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-ink">{r.name} <span className="text-xs text-ink-soft">({r.round_type})</span></p>
              <p className="text-xs text-ink-soft">
                {r.opens_at ? formatDate(r.opens_at) : "—"} → {r.closes_at ? formatDate(r.closes_at) : "—"}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  await deleteRound(r.id);
                  refetch();
                } catch (e) {
                  // surfaced by browser alert fallback
                  window.alert(errMessage(e));
                }
              }}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RoundEditor({ eventId, onSave }: { eventId: string; onSave: () => void }) {
  const [form, setForm] = useState({ name: "", round_type: "submission", opens_at: "", closes_at: "", advancement: "" });
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2 px-5 pb-4 sm:grid-cols-5">
      <Input placeholder="Round name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Select value={form.round_type} onChange={(e) => setForm({ ...form, round_type: e.target.value })}>
        <option value="submission">Submission</option>
        <option value="presentation">Presentation</option>
        <option value="interview">Interview</option>
        <option value="review">Review</option>
        <option value="other">Other</option>
      </Select>
      <Input type="datetime-local" value={form.opens_at} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} />
      <Input type="datetime-local" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} />
      <Button
        size="sm"
        loading={busy}
        disabled={form.name.trim().length < 2}
        onClick={async () => {
          setBusy(true);
          try {
            await upsertRound(eventId, {
              name: form.name.trim(),
              round_type: form.round_type as "submission",
              opens_at: form.opens_at || null,
              closes_at: form.closes_at || null,
              advancement: form.advancement || null,
            });
            setForm({ name: "", round_type: "submission", opens_at: "", closes_at: "", advancement: "" });
            onSave();
          } finally {
            setBusy(false);
          }
        }}
      >
        Add round
      </Button>
    </div>
  );
}

function AwardsSection({ eventId }: { eventId: string | null }) {
  const { data: awards, refetch } = useQuery({
    queryKey: ["es_awards", eventId],
    queryFn: () => listAwards(eventId!),
    enabled: !!eventId,
  });
  const [form, setForm] = useState({ name: "", category: "custom", prize_text: "" });
  const [busy, setBusy] = useState(false);
  if (!eventId) {
    return (
      <Card>
        <CardHeader title="Awards" sub="Save the draft first to configure awards." />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Awards" sub="Recognition only — no payment processing, and certificates are never auto-promised." />
      <div className="grid gap-2 px-5 pb-4 sm:grid-cols-4">
        <Input placeholder="Award name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="winner">Winner</option>
          <option value="runner_up">Runner-up</option>
          <option value="second_runner_up">Second runner-up</option>
          <option value="best_innovation">Best innovation</option>
          <option value="best_prototype">Best prototype</option>
          <option value="best_research">Best research</option>
          <option value="special_recognition">Special recognition</option>
          <option value="custom">Custom</option>
        </Select>
        <Input placeholder="Prize description (optional)" value={form.prize_text} onChange={(e) => setForm({ ...form, prize_text: e.target.value })} />
        <Button
          size="sm"
          loading={busy}
          disabled={form.name.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            try {
              await upsertAward(eventId, {
                name: form.name.trim(),
                category: form.category as "custom",
                prize_text: form.prize_text || null,
              });
              setForm({ name: "", category: "custom", prize_text: "" });
              refetch();
            } finally {
              setBusy(false);
            }
          }}
        >
          Add award
        </Button>
      </div>
      <ul className="space-y-2 px-5 pb-5">
        {(awards ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
            <span className="text-sm font-semibold text-ink">{a.name} <span className="text-xs text-ink-soft">({a.category.replace(/_/g, " ")})</span></span>
            <Button size="sm" variant="ghost" onClick={async () => { await deleteAward(a.id); refetch(); }}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function VisibilitySection({ draft, set }: SectionProps) {
  return (
    <Card>
      <CardHeader
        title="Visibility & publishing"
        sub="Unlisted events are reachable by direct link but never shown in discovery. Private events are visible only to participants and staff."
      />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <Field label="Event visibility" required>
          <Select value={draft.visibility} onChange={(e) => set("visibility", e.target.value as EsEventRow["visibility"])}>
            <option value="public">Public — listed in discovery</option>
            <option value="unlisted">Unlisted — direct link only</option>
            <option value="private">Private — participants only</option>
          </Select>
        </Field>
        <Field label="Results visibility">
          <p className="text-xs text-ink-soft">
            Results and showcase items are published separately after judging. Public pages only ever
            show organiser-approved, owner-approved content.
          </p>
        </Field>
      </div>
    </Card>
  );
}

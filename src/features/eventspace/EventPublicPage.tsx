import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Select,
  Textarea,
  PrivacyNote,
} from "../../components/ui";
import { getEventBySlug, listAwards, listRounds, eventMediaUrl, getMyRegistration } from "../../lib/eventspace";
import {
  ES_FORMAT_LABELS,
  esEventCategoryLabels,
  registrationWindowOpen,
  shareLinks,
  submissionWindowOpen,
} from "../../lib/eventspaceRules";
import { reportContent } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { errMessage } from "../../lib/api";
import { formatDate } from "../../lib/utils";

function EventShareActions({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const links = shareLinks(url, `Check out "${title}" on BuildProof`);
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => copy(url, "url")}>
        {copied === "url" ? "Link copied ✓" : "Copy link"}
      </Button>
      <a className="no-underline" href={links.whatsapp} target="_blank" rel="noopener noreferrer">
        <Button variant="secondary" size="sm">WhatsApp</Button>
      </a>
      <a className="no-underline" href={links.linkedin} target="_blank" rel="noopener noreferrer">
        <Button variant="secondary" size="sm">LinkedIn</Button>
      </a>
      <a className="no-underline" href={links.x} target="_blank" rel="noopener noreferrer">
        <Button variant="secondary" size="sm">X</Button>
      </a>
      <Link to={`/eventspace/${url.split("/").pop()}/showcase`} className="no-underline">
        <Button variant="secondary" size="sm">Showcase &amp; results</Button>
      </Link>
    </div>
  );
}

export default function EventPublicPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("misleading");
  const [reportDetail, setReportDetail] = useState("");
  const [reported, setReported] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  const { data: event, isLoading, error } = useQuery({
    queryKey: ["es_event", slug],
    queryFn: () => getEventBySlug(slug),
  });

  const { data: rounds } = useQuery({
    queryKey: ["es_rounds", event?.id],
    queryFn: () => listRounds(event!.id),
    enabled: !!event,
  });
  const { data: awards } = useQuery({
    queryKey: ["es_awards", event?.id],
    queryFn: () => listAwards(event!.id),
    enabled: !!event,
  });
  const { data: myReg } = useQuery({
    queryKey: ["es_my_reg", event?.id],
    queryFn: () => getMyRegistration(event!.id),
    enabled: !!event && !!user,
  });

  if (isLoading) return <LoadingBlock label="Loading event…" />;
  if (error) return <ErrorBanner message={errMessage(error)} />;
  if (!event) {
    return (
      <EmptyState
        title="Event not found"
        description="This event does not exist or is not publicly visible. Private events require an invitation."
      />
    );
  }

  const cover = eventMediaUrl(event.cover_path ?? event.poster_path);
  const regOpen = registrationWindowOpen(event);
  const subOpen = submissionWindowOpen(event);
  const eventUrl = `${window.location.origin}/eventspace/${event.slug}`;

  async function submitReport() {
    setReportErr(null);
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      await reportContent({
        reporter: user.id,
        subject_type: "es_event",
        subject_id: event!.id,
        reason: reportReason as "misleading" | "inappropriate" | "spam" | "other",
        detail: reportDetail || null,
      });
      setReported(true);
      setReportOpen(false);
    } catch (e) {
      setReportErr(errMessage(e));
    }
  }

  return (
    <article className="space-y-6">
      {cover ? (
        <img src={cover} alt="" className="h-56 w-full rounded-card object-cover sm:h-72" />
      ) : null}

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
            {esEventCategoryLabels[event.category]}
          </span>
          <span className="rounded-full border border-line px-2.5 py-1">{ES_FORMAT_LABELS[event.format]}</span>
          {event.edition ? <span className="rounded-full border border-line px-2.5 py-1">{event.edition}</span> : null}
          {event.theme ? <span className="rounded-full border border-line px-2.5 py-1">Theme: {event.theme}</span> : null}
        </div>
        <h1 className="display-title text-3xl sm:text-4xl">{event.title}</h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink-soft">{event.short_description}</p>
        <p className="text-sm font-semibold text-ink">
          {event.institution_name}
          {event.city ? ` · ${event.city}${event.state_name ? ", " + event.state_name : ""}` : ""}
          {" · "}
          {formatDate(event.starts_at)} – {formatDate(event.ends_at)}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {regOpen && !myReg ? (
          <Button
            onClick={() => navigate(user ? `/eventspace/${event.slug}/register` : "/login")}
          >
            Register now
          </Button>
        ) : null}
        {myReg ? (
          <Link to="/app/eventspace" className="no-underline">
            <Button>Go to your participant dashboard</Button>
          </Link>
        ) : null}
        {regOpen ? null : (
          <span className="rounded-full bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700">
            Registration closed
          </span>
        )}
        {subOpen ? (
          <span className="rounded-full bg-lime-100 px-3 py-1.5 text-[12px] font-semibold text-lime-800">
            Submissions open
          </span>
        ) : null}
      </div>

      <EventShareActions url={eventUrl} title={event.title} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Overview" />
            <div className="space-y-3 px-5 pb-5 text-[14.5px] leading-relaxed text-ink-soft">
              {event.full_description
                ? event.full_description.split("\n").map((p, i) => <p key={i}>{p}</p>)
                : <p>{event.short_description}</p>}
              {event.venue ? (
                <p>
                  <strong className="text-ink">Venue: </strong>
                  {event.venue}{" "}
                  {event.map_url ? (
                    <a className="text-brand-600 underline" href={event.map_url} target="_blank" rel="noopener noreferrer">
                      (map)
                    </a>
                  ) : null}
                </p>
              ) : null}
              {event.format !== "offline" && event.online_instructions ? (
                <p>
                  <strong className="text-ink">Online participation: </strong>
                  {event.online_instructions}
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Important dates" />
            <dl className="grid gap-2 px-5 pb-5 text-sm sm:grid-cols-2">
              {[
                ["Event start", event.starts_at],
                ["Event end", event.ends_at],
                ["Registration opens", event.registration_opens_at],
                ["Registration closes", event.registration_closes_at],
                ["Submission opens", event.submission_opens_at],
                ["Submission deadline", event.submission_deadline],
                ["Judging starts", event.judging_starts_at],
                ["Judging ends", event.judging_ends_at],
                ["Results announcement", event.results_at],
              ]
                .filter(([, v]) => v)
                .map(([label, v]) => (
                  <div key={label as string} className="flex justify-between gap-2 rounded-lg border border-line px-3 py-2">
                    <dt className="font-semibold text-ink">{label}</dt>
                    <dd className="text-ink-soft">{formatDate(v as string)}</dd>
                  </div>
                ))}
            </dl>
            <p className="px-5 pb-5 text-xs text-ink-soft">All times shown in your local timezone.</p>
          </Card>

          {rounds && rounds.length > 0 ? (
            <Card>
              <CardHeader title="Rounds" />
              <ol className="space-y-3 px-5 pb-5">
                {rounds.map((r) => (
                  <li key={r.id} className="rounded-xl border border-line p-3">
                    <p className="font-semibold text-ink">
                      {r.name} <span className="text-xs font-medium text-ink-soft">({r.round_type})</span>
                    </p>
                    {r.description ? <p className="mt-1 text-sm text-ink-soft">{r.description}</p> : null}
                    <p className="mt-1 text-xs text-ink-soft">
                      {r.opens_at ? formatDate(r.opens_at) : "Open"} → {r.closes_at ? formatDate(r.closes_at) : "close announced by organisers"}
                    </p>
                    {r.advancement ? <p className="mt-1 text-xs text-ink-soft">Advancement: {r.advancement}</p> : null}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          {event.rules ? (
            <Card>
              <CardHeader title="Rules & instructions" />
              <div className="space-y-3 px-5 pb-5 text-sm leading-relaxed text-ink-soft">
                {event.rules.split("\n").map((p, i) => <p key={i}>{p}</p>)}
                {event.submission_requirements ? (
                  <p><strong className="text-ink">Submission requirements: </strong>{event.submission_requirements}</p>
                ) : null}
                {event.originality_terms ? <p><strong className="text-ink">Originality: </strong>{event.originality_terms}</p> : null}
                {event.ip_terms ? <p><strong className="text-ink">Intellectual property: </strong>{event.ip_terms}</p> : null}
                {event.late_submission_terms ? <p><strong className="text-ink">Late submissions: </strong>{event.late_submission_terms}</p> : null}
                {event.disqualification_terms ? <p><strong className="text-ink">Disqualification: </strong>{event.disqualification_terms}</p> : null}
              </div>
            </Card>
          ) : null}

          {event.faq && event.faq.length > 0 ? (
            <Card>
              <CardHeader title="FAQ" />
              <dl className="space-y-3 px-5 pb-5">
                {event.faq.map((f, i) => (
                  <div key={i} className="rounded-xl border border-line p-3">
                    <dt className="font-semibold text-ink">{f.q}</dt>
                    <dd className="mt-1 text-sm text-ink-soft">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Eligibility" />
            <ul className="space-y-1.5 px-5 pb-5 text-sm text-ink-soft">
              <li>• Levels: {event.eligibility_levels.join(", ")}</li>
              {event.eligibility_years?.length ? <li>• Academic years: {event.eligibility_years.join(", ")}</li> : null}
              {event.eligibility_departments?.length ? <li>• Departments: {event.eligibility_departments.join(", ")}</li> : null}
              {event.eligibility_institutions?.length ? <li>• Institutions: {event.eligibility_institutions.join(", ")}</li> : null}
              {event.eligibility_regions?.length ? <li>• Regions: {event.eligibility_regions.join(", ")}</li> : null}
              <li>
                • Participation:{" "}
                {event.participation === "individual"
                  ? "Individual only"
                  : event.participation === "team"
                    ? `Team only (${event.min_team_size}–${event.max_team_size} members)`
                    : `Individual or team (${event.min_team_size}–${event.max_team_size} members)`}
              </li>
              {event.age_note ? <li>• {event.age_note}</li> : null}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Registration" />
            <div className="space-y-2 px-5 pb-5 text-sm text-ink-soft">
              <p>
                {regOpen ? "Registration is open." : "Registration is closed."}
                {event.registration_capacity ? ` Limited to ${event.registration_capacity} participants.` : ""}
                {event.registration_approval ? " Organiser approval required." : ""}
              </p>
              {event.registration_note ? <p>{event.registration_note}</p> : null}
            </div>
          </Card>

          {awards && awards.length > 0 ? (
            <Card>
              <CardHeader title="Awards" />
              <ul className="space-y-2 px-5 pb-5 text-sm">
                {awards.map((a) => (
                  <li key={a.id}>
                    <p className="font-semibold text-ink">{a.name}</p>
                    {a.prize_text ? <p className="text-ink-soft">{a.prize_text}</p> : null}
                    {a.sponsor ? <p className="text-xs text-ink-soft">Sponsored by {a.sponsor}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Contact & organiser" />
            <div className="space-y-1.5 px-5 pb-5 text-sm text-ink-soft">
              <p>Organised by {event.institution_name}.</p>
              {event.contact_name ? <p>Contact: {event.contact_name}</p> : null}
              {event.contact_email ? <p>Email: {event.contact_email}</p> : null}
              {event.contact_phone ? <p>Phone: {event.contact_phone}</p> : null}
              {event.official_url ? (
                <p>
                  <a className="text-brand-600 underline" href={event.official_url} target="_blank" rel="noopener noreferrer">
                    Official page
                  </a>
                </p>
              ) : null}
            </div>
          </Card>

          <div>
            {reported ? (
              <p className="text-xs text-ink-soft">Thanks — this event has been reported for review.</p>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setReportOpen((v) => !v)}>
                Report this event
              </Button>
            )}
            {reportOpen ? (
              <Card className="mt-2">
                <div className="space-y-3 p-4">
                  <Field label="Reason">
                    <Select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                      <option value="misleading">Misleading</option>
                      <option value="inappropriate">Inappropriate</option>
                      <option value="spam">Spam</option>
                      <option value="other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Details (optional)">
                    <Textarea rows={3} value={reportDetail} onChange={(e) => setReportDetail(e.target.value)} />
                  </Field>
                  {reportErr ? <ErrorBanner message={reportErr} /> : null}
                  <Button size="sm" onClick={submitReport}>Submit report</Button>
                </div>
              </Card>
            ) : null}
          </div>
        </aside>
      </div>

      <PrivacyNote>
        Submissions and files are private to participants, organisers and assigned judges. Public
        showcases appear only after the project owner approves publication.
      </PrivacyNote>
    </article>
  );
}

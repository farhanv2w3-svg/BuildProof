import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  LoadingBlock,
  PageTitle,
  Textarea,
  SuccessBanner,
  Badge,
} from "../../components/ui";
import {
  applyForOrganizer,
  getMyOrganizerApplication,
  listMyManagedEvents,
  withdrawOrganizerApplication,
} from "../../lib/eventspace";
import { useAuth } from "../../lib/auth";
import { errMessage } from "../../lib/api";
import { formatDate } from "../../lib/utils";
import type { EsEventRow } from "../../types/database";

function ApplyPanel() {
  const qc = useQueryClient();
  const { data: app, isLoading } = useQuery({
    queryKey: ["es_my_organizer_app"],
    queryFn: getMyOrganizerApplication,
  });

  const [form, setForm] = useState({
    org_name: "",
    official_email: "",
    position: "",
    website: "",
    reason: "",
    verification_notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const apply = useMutation({
    mutationFn: () =>
      applyForOrganizer({
        org_name: form.org_name,
        official_email: form.official_email,
        position: form.position,
        website: form.website || null,
        reason: form.reason,
        verification_notes: form.verification_notes || null,
      }),
    onSuccess: () => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ["es_my_organizer_app"] });
    },
    onError: (e) => setError(errMessage(e)),
  });

  const withdraw = useMutation({
    mutationFn: withdrawOrganizerApplication,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["es_my_organizer_app"] }),
    onError: (e) => setError(errMessage(e)),
  });

  if (isLoading) return <LoadingBlock />;

  if (app && app.status !== "rejected") {
    return (
      <Card>
        <CardHeader
          title="Your organiser application"
          action={<Badge tone={app.status === "approved" ? "success" : app.status === "suspended" ? "danger" : "neutral"}>{app.status}</Badge>}
        />
        <div className="space-y-2 px-5 pb-5 text-sm text-ink-soft">
          <p><strong className="text-ink">{app.org_name}</strong> · {app.position} · {app.official_email}</p>
          {app.review_note ? <p>Review note: {app.review_note}</p> : null}
          {app.status === "pending" ? (
            <p>Applications are reviewed by platform administrators. You will be notified when a decision is made.</p>
          ) : null}
          {app.status === "suspended" ? (
            <p>Your organiser access is currently suspended. Contact support for details.</p>
          ) : null}
          {app.status === "pending" ? (
            <Button variant="secondary" size="sm" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>
              Withdraw application
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  if (done) return <SuccessBanner message="Application submitted — administrators will review it soon." />;

  return (
    <Card>
      <CardHeader
        title="Apply to organise events"
        sub="Ordinary accounts do not automatically get organiser privileges. Applications are verified by platform administrators."
      />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <Field label="Institution / organisation" required>
          <Input value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} maxLength={200} />
        </Field>
        <Field label="Official email" required>
          <Input type="email" value={form.official_email} onChange={(e) => setForm({ ...form, official_email: e.target.value })} />
        </Field>
        <Field label="Your position / role" required>
          <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Website (optional)">
          <Input type="url" placeholder="https://…" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Why do you want to organise events on BuildProof?" required hint="Include the kinds of events you plan to run.">
            <Textarea rows={4} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Supporting verification information (optional)" hint="Faculty ID, club registration, past event links — anything that helps verification.">
            <Textarea rows={3} value={form.verification_notes} onChange={(e) => setForm({ ...form, verification_notes: e.target.value })} />
          </Field>
        </div>
        {error ? <div className="sm:col-span-2"><ErrorBanner message={error} /></div> : null}
        <div className="sm:col-span-2">
          <Button
            loading={apply.isPending}
            disabled={
              form.org_name.trim().length < 2 ||
              form.official_email.trim().length < 5 ||
              form.position.trim().length < 2 ||
              form.reason.trim().length < 20
            }
            onClick={() => apply.mutate()}
          >
            Submit application
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function OrganizerPage() {
  const { user } = useAuth();
  const { data: events, isLoading, error } = useQuery({
    queryKey: ["es_my_managed_events"],
    queryFn: listMyManagedEvents,
  });
  const { data: app, isLoading: appLoading } = useQuery({
    queryKey: ["es_my_organizer_app"],
    queryFn: getMyOrganizerApplication,
  });

  const approved = app?.status === "approved";
  const drafts = (events ?? []).filter((e: EsEventRow) => e.status === "draft");
  const live = (events ?? []).filter((e: EsEventRow) => e.status !== "draft");

  if (!user) {
    return (
      <div className="space-y-6">
        <PageTitle title="EventSpace organiser" sub="Sign in to apply and manage your events." />
        <ApplyPanel />
        <EmptyState
          title="Sign in to continue"
          description="Organiser applications and event management require a BuildProof account."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="EventSpace organiser"
        sub="Apply for organiser access, then create and manage your events."
        action={
          approved ? (
            <Link to="/app/eventspace/create" className="no-underline">
              <Button>Create event</Button>
            </Link>
          ) : null
        }
      />

      {error ? <ErrorBanner message={errMessage(error)} /> : null}

      <ApplyPanel />

      {approved ? (
        isLoading || appLoading ? (
          <LoadingBlock />
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Live events</h2>
              {!live.length ? (
                <EmptyState title="No published events yet" description="Create your first event to get started." />
              ) : (
                <div className="space-y-3">
                  {live.map((e) => (
                    <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-bold text-ink">{e.title}</p>
                        <p className="text-xs text-ink-soft">
                          {formatDate(e.starts_at)} · {e.status}
                          {e.visibility !== "public" ? ` · ${e.visibility}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/eventspace/${e.slug}`} className="no-underline">
                          <Button size="sm" variant="ghost">View public page</Button>
                        </Link>
                        <Link to={`/app/eventspace/${e.id}/manage`} className="no-underline">
                          <Button size="sm">Manage</Button>
                        </Link>
                        <Link to={`/app/eventspace/${e.id}/promote`} className="no-underline">
                          <Button size="sm" variant="secondary">Promotion kit</Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
            {drafts.length ? (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Drafts</h2>
                <div className="space-y-3">
                  {drafts.map((e) => (
                    <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-bold text-ink">{e.title}</p>
                        <p className="text-xs text-ink-soft">Draft · updated {formatDate(e.updated_at)}</p>
                      </div>
                      <Link to={`/app/eventspace/${e.id}/edit`} className="no-underline">
                        <Button size="sm">Continue editing</Button>
                      </Link>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )
      ) : null}

      <section className="pt-2">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">What organisers get</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ORGANISER_BENEFITS.map((b) => (
            <EventCardLike key={b.t} title={b.t} desc={b.d} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EventCardLike({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="p-4">
      <p className="font-bold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{desc}</p>
    </Card>
  );
}

const ORGANISER_BENEFITS: Array<{ t: string; d: string }> = [
  { t: "Verified events", d: "Your events carry your institution's name and pass a publication checklist." },
  { t: "Private submissions", d: "Participants' project files stay private; judges see only what they're assigned." },
  { t: "Fair judging", d: "Server-recomputed weighted scores; you see summaries, judges keep private notes." },
  { t: "Public showcase", d: "Publish winning projects only after each team approves its own content." },
  { t: "Promotion kit", d: "Downloadable graphics, QR codes and ready-made captions for every event." },
  { t: "Real analytics", d: "Registrations, teams, submissions and judging progress — aggregate only." },
];

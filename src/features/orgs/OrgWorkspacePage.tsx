import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  registerOrganization, listMyOrganizations,
  listOrgCompanyProjects, createCompanyProject, updateCompanyProject,
  listPaymentMilestones, createPaymentMilestone, updatePaymentMilestone,
  createFundingOpportunity, createOpportunity, listOrgOpportunityApplications, decideOpportunityApplication,
} from "../../lib/api";
import type {
  CompanyProject, FundingOpportunity, JobOpportunity, Organization,
  PaymentMilestone, OpportunityApplication,
} from "../../types/database";
import {
  Button, Card, ErrorBanner, Field, Input, LoadingBlock, Select, Textarea,
} from "../../components/ui";
import { StatusBadge, VerificationNote, money, moneyRange } from "../../components/DomainKit";
import { demoBeginnerTask } from "../../lib/demoData";
import { DemoCard } from "../../components/DomainKit";
import { useAuth } from "../../lib/auth";

/* Company / funder workspace. Registering an organisation does NOT make it
 * verified — verification is a platform-admin action shown honestly everywhere. */

export default function OrgWorkspacePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Organization["kind"]>("company");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["myOrgs", user?.id],
    queryFn: () => listMyOrganizations(user!.id),
    enabled: !!user?.id,
  });

  async function submitOrg(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSuccess(null);
    try {
      if (name.trim().length < 2) throw new Error("Organisation name needs at least 2 characters.");
      await registerOrganization(
        {
          name: name.trim(),
          kind,
          description: description.trim() || undefined,
          website_url: website.trim() || undefined,
          city: city.trim() || undefined,
        },
        user!.id
      );
      setName(""); setCity(""); setWebsite(""); setDescription("");
      setSuccess("Organisation registered. It is unverified until a platform administrator confirms it — that will be shown honestly wherever it appears.");
      await qc.invalidateQueries({ queryKey: ["myOrgs", user?.id] });
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Registration failed.");
    } finally { setBusy(false); }
  }

  if (isLoading) return <LoadingBlock />;
  const myOrgs = (orgs ?? []) as (Organization & { org_role: string })[];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-title text-2xl">Organisation workspace</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">
            For companies, small businesses, NGOs and funders. Registering lets you post real company projects,
            funding programmes and opportunities — all subject to platform checks and honest verification labels.
          </p>
        </div>
      </div>

      {success && <div className="mb-4"><ErrorBanner message={success} /></div>}

      {myOrgs.length === 0 ? (
        <Card className="p-5">
          <h2 className="text-[15px] font-bold text-ink">Register an organisation</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitOrg}>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={160} placeholder="e.g. Vasundhara Agri Services" />
            </Field>
            <Field label="Kind">
              <Select value={kind} onChange={(e) => setKind(e.target.value as Organization["kind"])}>
                {["company", "small_business", "ngo", "funder", "accelerator", "research_lab"].map((k) => (
                  <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </Field>
            <Field label="City (optional)">
              <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Website (optional)">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} placeholder="https://…" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="What your organisation does (optional)">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
              </Field>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit" loading={busy}>Register organisation</Button>
              {error && <span className="text-[12.5px] text-danger" role="alert">{error}</span>}
            </div>
          </form>
          {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
          <p className="mt-3 text-[12px] text-ink-soft">
            You become the owner on registration. Additional representatives are added by platform administrators to
            prevent self-claims of company authority.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {myOrgs.map((org) => (
            <Card key={org.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold text-ink">{org.name}</h2>
                  <p className="text-[12.5px] text-ink-soft">{org.kind.replace(/_/g, " ")}{org.city ? ` · ${org.city}` : ""} · your role: {org.org_role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <VerificationNote status={org.verification_status} />
                  {org.verification_status !== "verified" && (
                    <span className="text-[11.5px] text-ink-soft">A platform admin must verify before it is trusted.</span>
                  )}
                </div>
              </div>
              {org.description && <p className="mt-2 text-[13px] text-ink-soft">{org.description}</p>}

              {/* Project posting + payments (owner/representative only, RLS enforced) */}
              {(org.org_role === "owner" || org.org_role === "representative") && (
                <>
                  <OrgProjectSection orgId={org.id} />
                  <FundingJobSection orgId={org.id} />
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      {success && <p className="mt-3 text-[13px] text-success" role="status">{success}</p>}
    </div>
  );
}

/* ------------------- company projects + payment milestones --------- */

function OrgProjectSection({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: projects } = useQuery({
    queryKey: ["orgProjects", orgId],
    queryFn: () => listOrgCompanyProjects(orgId),
  });

  const rows = (projects ?? []) as CompanyProject[];

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-ink">Company projects</h3>
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>{open ? "Close form" : "Post a project"}</Button>
      </div>
      {open && (
        <CompanyProjectForm
          orgId={orgId}
          userId={user!.id}
          onDone={async () => { setOpen(false); await qc.invalidateQueries({ queryKey: ["orgProjects", orgId] }); }}
          onError={setError}
        />
      )}
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
      {rows.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-ink-soft">No projects posted yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{p.title}</p>
                  <p className="text-[12px] text-ink-soft">
                    {p.level} · team of {p.team_size}{p.budget_min_amount != null ? ` · ${moneyRange(p.budget_min_amount, p.budget_max_amount, p.budget_currency)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  {p.status === "draft" && (
                    <Button size="sm" variant="secondary" onClick={async () => {
                      try { await updateCompanyProject(p.id, { status: "listed" }); await qc.invalidateQueries({ queryKey: ["orgProjects", orgId] }); }
                      catch (e) { setError(e instanceof Error ? e.message : "Failed to publish."); }
                    }}>Publish listing</Button>
                  )}
                  {p.status === "listed" && (
                    <Select
                      aria-label={`Project status for ${p.title}`}
                      className="w-40 text-[11.5px]"
                      value={p.status}
                      onChange={async (e) => {
                        try { await updateCompanyProject(p.id, { status: e.target.value as CompanyProject["status"] }); await qc.invalidateQueries({ queryKey: ["orgProjects", orgId] }); }
                        catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
                      }}
                    >
                      {["listed", "in_review", "in_progress", "completed", "closed"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </Select>
                  )}
                </div>
              </div>
              {p.acceptance_criteria && <p className="mt-1 text-[12px] text-ink-soft">Acceptance: {p.acceptance_criteria}</p>}
              {p.status !== "draft" && <PaymentMilestonesSection projectId={p.id} />}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 max-w-2xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">Example posting</p>
        <DemoCard demo={demoBeginnerTask} compact />
      </div>
    </div>
  );
}

function CompanyProjectForm({
  orgId, userId, onDone, onError,
}: { orgId: string; userId: string; onDone: () => Promise<void> | void; onError: (s: string) => void }) {
  const [f, setF] = useState({
    title: "", description: "", level: "beginner", skills: "", deliverables: "",
    team_size: "1", duration_weeks: "", budget_min: "", budget_max: "",
    payment_terms: "", acceptance_criteria: "", revision_policy: "", ip_terms: "",
    confidentiality_note: "", supervision_note: "",
  });
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-3 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          if (f.title.trim().length < 4 || f.description.trim().length < 20)
            throw new Error("Title needs 4+ characters and description 20+.");
          const minAmt = f.budget_min ? Number(f.budget_min) : null;
          const maxAmt = f.budget_max ? Number(f.budget_max) : null;
          await createCompanyProject({
            organization_id: orgId,
            posted_by: userId,
            title: f.title.trim(),
            description: f.description.trim(),
            level: f.level as CompanyProject["level"],
            required_skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
            deliverables: f.deliverables.trim() || null,
            team_size: Math.max(1, Number(f.team_size) || 1),
            duration_weeks: f.duration_weeks ? Number(f.duration_weeks) : null,
            budget_currency: "INR",
            budget_min_amount: minAmt && minAmt >= 0 ? Math.round(minAmt) : null,
            budget_max_amount: maxAmt && maxAmt >= (minAmt ?? 0) ? Math.round(maxAmt) : minAmt !== null && maxAmt !== null ? Math.round(maxAmt) : maxAmt !== null ? Math.round(maxAmt) : null,
            payment_terms: f.payment_terms.trim() || null,
            acceptance_criteria: f.acceptance_criteria.trim() || null,
            revision_policy: f.revision_policy.trim() || null,
            ip_terms: f.ip_terms.trim() || null,
            confidentiality_note: f.confidentiality_note.trim() || null,
            supervision_note: f.supervision_note.trim() || null,
            selected_team_id: null,
            status: "draft",
          });
          setF({ ...f, title: "", description: "", skills: "", deliverables: "" });
          await onDone();
        } catch (err) {
          onError(err instanceof Error ? err.message : "Could not post project.");
        } finally { setBusy(false); }
      }}
    >
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={4} maxLength={180} placeholder="Small inventory dashboard, V1" /></Field>
      <Field label="Difficulty level">
        <Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
          {["beginner", "intermediate", "advanced"].map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Actual business need (this is where honesty matters)">
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} required minLength={20} maxLength={4000} />
        </Field>
      </div>
      <Field label="Required skills (comma-separated)"><Input value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} placeholder="Frontend development, UI/UX design" /></Field>
      <Field label="Team size"><Input type="number" min={1} max={50} value={f.team_size} onChange={(e) => setF({ ...f, team_size: e.target.value })} /></Field>
      <Field label="Duration (weeks)"><Input type="number" min={1} max={104} value={f.duration_weeks} onChange={(e) => setF({ ...f, duration_weeks: e.target.value })} /></Field>
      <Field label="Deliverables"><Input value={f.deliverables} onChange={(e) => setF({ ...f, deliverables: e.target.value })} maxLength={2000} /></Field>
      <Field label="Budget min (₹)"><Input type="number" min={0} value={f.budget_min} onChange={(e) => setF({ ...f, budget_min: e.target.value })} /></Field>
      <Field label="Budget max (₹)"><Input type="number" min={0} value={f.budget_max} onChange={(e) => setF({ ...f, budget_max: e.target.value })} /></Field>
      <Field label="Payment schedule"><Input value={f.payment_terms} onChange={(e) => setF({ ...f, payment_terms: e.target.value })} maxLength={1500} placeholder="e.g. 50% after first milestone, 50% after acceptance" /></Field>
      <div className="sm:col-span-2"><Field label="Acceptance criteria"><Textarea value={f.acceptance_criteria} onChange={(e) => setF({ ...f, acceptance_criteria: e.target.value })} rows={2} maxLength={2000} /></Field></div>
      <Field label="Revision policy"><Input value={f.revision_policy} onChange={(e) => setF({ ...f, revision_policy: e.target.value })} maxLength={1000} placeholder="Two revision rounds included" /></Field>
      <Field label="IP / licensing terms"><Input value={f.ip_terms} onChange={(e) => setF({ ...f, ip_terms: e.target.value })} maxLength={1500} placeholder="e.g. Work-for-hire on acceptance; attribution retained" /></Field>
      <Field label="Confidentiality note"><Input value={f.confidentiality_note} onChange={(e) => setF({ ...f, confidentiality_note: e.target.value })} maxLength={1000} /></Field>
      <Field label="Supervision note"><Input value={f.supervision_note} onChange={(e) => setF({ ...f, supervision_note: e.target.value })} maxLength={1000} placeholder="e.g. Weekly mentoring call; supervised access to test data only" /></Field>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" loading={busy}>Create draft (publish after review)</Button>
        <span className="text-[11.5px] text-ink-soft">Drafts stay private until you publish them.</span>
      </div>
    </form>
  );
}

function PaymentMilestonesSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["paymentMilestones", projectId],
    queryFn: () => listPaymentMilestones(projectId),
  });
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rows = (data ?? []) as PaymentMilestone[];

  if (isLoading) return <LoadingBlock label="Loading payment milestones…" />;

  return (
    <div className="mt-2 rounded-lg bg-canvas p-3">
      <h4 className="text-[12.5px] font-bold text-ink">Payment record (agreed milestones — records only, no money is processed here)</h4>
      {rows.length === 0 ? (
        <p className="mt-1 text-[12px] text-ink-soft">No payment milestones agreed yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-surface px-2.5 py-2">
              <span className="text-[12.5px] font-medium text-ink">{p.title} — {money(p.amount_cents, p.currency)}</span>
              <span className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                <Select
                  aria-label={`Payment status for ${p.title}`}
                  className="w-32 text-[11.5px]"
                  value={p.status}
                  onChange={async (e) => {
                    try { await updatePaymentMilestone(p.id, { status: e.target.value as PaymentMilestone["status"] }); await qc.invalidateQueries({ queryKey: ["paymentMilestones", projectId] }); }
                    catch (err) { setError(err instanceof Error ? err.message : "The payment guard blocked this change."); }
                  }}
                >
                  {["agreed", "pending", "due", "disputed", "cancelled", "paid"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </Select>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-[12px] text-danger" role="alert">{error}</p>}
      <form
        className="mt-2 flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            if (title.trim().length < 2) throw new Error("Milestone title required.");
            const amt = Math.round(Number(amount) * 100);
            if (!Number.isFinite(amt) || amt < 0) throw new Error("Amount must be a positive number.");
            await createPaymentMilestone({ company_project_id: projectId, title: title.trim(), amount_cents: amt });
            setTitle(""); setAmount("");
            await qc.invalidateQueries({ queryKey: ["paymentMilestones", projectId] });
          } catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Milestone title e.g. Dashboard deployed" className="w-56" aria-label="Payment milestone title" />
        <Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ₹" className="w-36" aria-label="Payment milestone amount in rupees" />
        <Button type="submit" size="sm">Add</Button>
      </form>
      <p className="mt-1 text-[11px] text-ink-soft">
        Only the sponsoring organisation (or platform admins) can mark a milestone paid, and confirmed payments
        cannot be silently un-confirmed — the database enforces this.
      </p>
    </div>
  );
}

/* ------------------- funding & job opportunities -------------------- */

function FundingJobSection({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"funding" | "jobs" | "apps">("jobs");
  const [error, setError] = useState<string | null>(null);

  const { data: managedApps } = useQuery({
    queryKey: ["orgOppApplications", orgId],
    queryFn: () => listOrgOpportunityApplications(orgId),
    enabled: tab === "apps",
  });

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tab === "jobs" ? "primary" : "secondary"} onClick={() => setTab("jobs")}>Post an opportunity</Button>
        <Button size="sm" variant={tab === "funding" ? "primary" : "secondary"} onClick={() => setTab("funding")}>Post funding</Button>
        <Button size="sm" variant={tab === "apps" ? "primary" : "secondary"} onClick={() => setTab("apps")}>Applications I manage</Button>
      </div>
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}

      {tab === "jobs" && (
        <OpportunityForm
          orgId={orgId}
          userId={user!.id}
          onError={setError}
          onDone={async () => { setError(null); await qc.invalidateQueries(); }}
        />
      )}
      {tab === "funding" && (
        <FundingForm
          orgId={orgId}
          userId={user!.id}
          onError={setError}
        />
      )}
      {tab === "apps" && (
        <div className="mt-3 space-y-2">
          {((managedApps ?? []) as (OpportunityApplication & { opportunity: JobOpportunity | null; profile: { full_name: string } | null })[]).length === 0 ? (
            <p className="text-[12.5px] text-ink-soft">No applications tied to your opportunities yet.</p>
          ) : (
            ((managedApps ?? []) as (OpportunityApplication & { opportunity: JobOpportunity | null; profile: { full_name: string } | null })[]).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2.5">
                <div>
                  <p className="text-[13px] font-semibold text-ink">{a.opportunity?.title ?? "Opportunity"}</p>
                  <p className="text-[12px] text-ink-soft">Applicant: {a.profile?.full_name ?? "—"} · {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <span className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  <Select
                    aria-label="Application status decision"
                    className="w-36 text-[11.5px]"
                    value={a.status}
                    onChange={async (e) => {
                      try { await decideOpportunityApplication(a.id, e.target.value as OpportunityApplication["status"]); await qc.invalidateQueries({ queryKey: ["orgOppApplications", orgId] }); }
                      catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
                    }}
                  >
                    {["submitted", "under_review", "interviewing", "accepted", "declined"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </Select>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function OpportunityForm({
  orgId, userId, onDone, onError,
}: { orgId: string; userId: string; onDone: () => Promise<void> | void; onError: (s: string) => void }) {
  const [f, setF] = useState({
    title: "", kind: "internship", description: "", skills: "",
    location_type: "onsite", city: "", commitment_note: "", compensation_note: "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-3 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          if (f.title.trim().length < 4 || f.description.trim().length < 20)
            throw new Error("Title needs 4+ characters and description 20+.");
          // Explicit: students must be told if this is paid; unpaid stays honest.
          await createOpportunity({
            organization_id: orgId,
            posted_by: userId,
            title: f.title.trim(),
            kind: f.kind as JobOpportunity["kind"],
            description: f.description.trim(),
            required_skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
            location_type: f.location_type as JobOpportunity["location_type"],
            city: f.city.trim() || null,
            commitment_note: f.commitment_note.trim() || null,
            compensation_note: f.compensation_note.trim() || null,
            status: "open",
          });
          await onDone();
          onError("");
        } catch (err) { onError(err instanceof Error ? err.message : "Could not post opportunity."); }
        finally { setBusy(false); }
      }}
    >
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={4} maxLength={180} /></Field>
      <Field label="Kind">
        <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          {["internship", "entry_level", "apprenticeship", "research", "hardware_role", "founding_team", "project_contract"].map((k) => (
            <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} required minLength={20} maxLength={3000} />
        </Field>
      </div>
      <Field label="Required skills (comma-separated)"><Input value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></Field>
      <Field label="Location type">
        <Select value={f.location_type} onChange={(e) => setF({ ...f, location_type: e.target.value })}>
          {["onsite", "remote", "hybrid"].map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
      </Field>
      <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} maxLength={120} /></Field>
      <Field label="Compensation (never disguised — write unpaid if unpaid)"><Input value={f.compensation_note} onChange={(e) => setF({ ...f, compensation_note: e.target.value })} maxLength={500} placeholder="e.g. ₹15,000/month stipend" /></Field>
      <div className="sm:col-span-2"><Field label="Commitment note"><Input value={f.commitment_note} onChange={(e) => setF({ ...f, commitment_note: e.target.value })} maxLength={300} placeholder="e.g. 20 hrs/week during semester" /></Field></div>
      <div className="sm:col-span-2"><Button type="submit" loading={busy}>Publish opportunity</Button></div>
    </form>
  );
}

function FundingForm({ orgId, userId, onError }: { orgId: string; userId: string; onError: (s: string) => void }) {
  const [f, setF] = useState({ title: "", category: "prototype_funding", description: "", criteria: "", min_amount: "", max_amount: "", application_requirements: "" });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-3 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          if (f.title.trim().length < 4 || f.description.trim().length < 20)
            throw new Error("Title needs 4+ characters and description 20+.");
          await createFundingOpportunity({
            organization_id: orgId,
            created_by: userId,
            title: f.title.trim(),
            category: f.category as FundingOpportunity["category"],
            description: f.description.trim(),
            criteria: f.criteria.trim() || null,
            min_amount: f.min_amount ? Number(f.min_amount) : null,
            max_amount: f.max_amount ? Number(f.max_amount) : null,
            currency: "INR",
            application_requirements: f.application_requirements.trim() || null,
            status: "open",
          });
          setF({ ...f, title: "", description: "", criteria: "", min_amount: "", max_amount: "", application_requirements: "" });
          onError("");
        } catch (err) { onError(err instanceof Error ? err.message : "Could not post funding."); }
        finally { setBusy(false); }
      }}
    >
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={4} maxLength={180} /></Field>
      <Field label="Category">
        <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {["prototype_funding", "hardware_funding", "startup_capital", "grant_competition", "incubation", "manufacturing_support", "sponsored_research"].map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2"><Field label="Description (state expectations plainly — no promises of success)"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} required minLength={20} maxLength={3000} /></Field></div>
      <div className="sm:col-span-2"><Field label="Criteria"><Textarea value={f.criteria} onChange={(e) => setF({ ...f, criteria: e.target.value })} rows={2} maxLength={2000} /></Field></div>
      <Field label="Min amount (₹)"><Input type="number" min={0} value={f.min_amount} onChange={(e) => setF({ ...f, min_amount: e.target.value })} /></Field>
      <Field label="Max amount (₹)"><Input type="number" min={0} value={f.max_amount} onChange={(e) => setF({ ...f, max_amount: e.target.value })} /></Field>
      <div className="sm:col-span-2"><Field label="Application requirements"><Input value={f.application_requirements} onChange={(e) => setF({ ...f, application_requirements: e.target.value })} maxLength={1500} /></Field></div>
      <div className="sm:col-span-2"><Button type="submit" loading={busy}>Publish funding programme</Button></div>
    </form>
  );
}

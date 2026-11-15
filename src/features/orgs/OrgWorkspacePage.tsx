import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  registerOrganization, listMyOrganizations,
  listOrgCompanyProjects, createCompanyProject, updateCompanyProject,
  listPaymentMilestones, createPaymentMilestone, updatePaymentMilestone,
  createFundingOpportunity, createOpportunity, listOrgOpportunityApplications, decideOpportunityApplication,
  listFundingOpportunities, listOpportunities, updateFundingOpportunity, updateOpportunity, errMessage,
  fetchOrganizationRoster, addOrganizationMember, removeOrganizationMember, findUserIdByEmail,
  listFundingApplications, decideFundingApplication,
} from "../../lib/api";
import type {
  CompanyProject, FundingOpportunity, JobOpportunity, Organization,
  PaymentMilestone, OpportunityApplication,
} from "../../types/database";
import {
  Button, Card, Badge, ConfirmDialog, ErrorBanner, Field, Input, LoadingBlock, Select, SuccessBanner, Textarea,
} from "../../components/ui";
import { StatusBadge, VerificationNote, money, moneyRange } from "../../components/DomainKit";
import { DemoCard } from "../../components/DomainKit";
import { demoBeginnerTask } from "../../lib/demoData";
import { titleize } from "../../lib/utils";
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

      {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

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
                  <OrgRosterSection orgId={org.id} />
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

/** B13 — organization roster: viewed by everyone in the org; owner/rep can add
 * (by email) and remove members. Escalation is bounded: adding members grants
 * only the accepting workflow (they confirm their own membership by email-based
 * invite accept or leave proposed until?), and role grants stay admin-only. */
function OrgRosterSection({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [removeMember, setRemoveMember] = useState<{ id: string; name: string } | null>(null);

  const { data: roster } = useQuery({
    queryKey: ["orgRoster", orgId],
    queryFn: () => fetchOrganizationRoster(orgId),
  });

  const add = async () => {
    setBusy(true); setError(null); setOk(null);
    try {
      const uid = await findUserIdByEmail(email.trim().toLowerCase());
      if (!uid) {
        setError("No BuildProof account for that email. The person must sign up first.");
        return;
      }
      await addOrganizationMember(orgId, uid);
      setOk("Member added. They see the organisation workspace after signing in.");
      setEmail("");
      await qc.invalidateQueries({ queryKey: ["orgRoster", orgId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add member.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="text-[14px] font-bold text-ink">Organisation roster</h3>
      {(roster ?? []).length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-soft">Just you so far.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {(roster ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px]">
              <span>
                <strong className="font-semibold">{m.profile?.full_name ?? "Member"}</strong>
                <span className="ml-2 text-[12px] text-ink-soft">{m.org_role}</span>
              </span>
              <button
                className="text-[12px] font-semibold text-danger hover:underline"
                onClick={() => setRemoveMember({ id: m.id, name: m.profile?.full_name ?? "this member" })}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-ink">Add member by email</span>
          <Input className="max-w-xs" type="email" placeholder="member@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <Button size="sm" onClick={add} loading={busy} disabled={email.trim().length < 5}>Add member</Button>
      </div>
      {ok && <p className="mt-2 text-[12.5px] font-medium text-success" role="status">{ok}</p>}
      {error && <div className="mt-2 max-w-xl"><ErrorBanner message={error} /></div>}
      <ConfirmDialog
        open={removeMember !== null}
        title={`Remove ${removeMember?.name ?? "member"}?`}
        description="This person will lose access to the organisation workspace."
        confirmLabel="Remove member"
        destructive
        onCancel={() => setRemoveMember(null)}
        onConfirm={async () => {
          if (!removeMember) return;
          const member = removeMember;
          setRemoveMember(null);
          setError(null);
          try { await removeOrganizationMember(member.id); }
          catch (e) { setError(e instanceof Error ? e.message : "Could not remove member."); }
          await qc.invalidateQueries({ queryKey: ["orgRoster", orgId] });
        }}
      />
    </div>
  );
}

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
  const [tab, setTab] = useState<"funding" | "jobs" | "apps" | "listings">("jobs");
  const [error, setError] = useState<string | null>(null);

  const { data: managedApps } = useQuery({
    queryKey: ["orgOppApplications", orgId],
    queryFn: () => listOrgOpportunityApplications(orgId),
    enabled: tab === "apps",
  });
  // B10: the org's own published listings — pause/close lives HERE (was
  // missing entirely: updateFundingOpportunity/updateOpportunity unreachable).
  const { data: listings } = useQuery({
    queryKey: ["orgListings", orgId],
    queryFn: async () => {
      const [funding, jobs] = await Promise.all([listFundingOpportunities(), listOpportunities()]);
      return { funding, jobs };
    },
    enabled: tab === "listings",
  });

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={tab === "jobs" ? "primary" : "secondary"} onClick={() => setTab("jobs")}>Post an opportunity</Button>
        <Button size="sm" variant={tab === "funding" ? "primary" : "secondary"} onClick={() => setTab("funding")}>Post funding</Button>
        <Button size="sm" variant={tab === "apps" ? "primary" : "secondary"} onClick={() => setTab("apps")}>Applications I manage</Button>
        <Button size="sm" variant={tab === "listings" ? "primary" : "secondary"} onClick={() => setTab("listings")}>My listings</Button>
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

      {tab === "listings" && (
        <div className="mt-3 space-y-3">
          <p className="text-[12.5px] text-ink-soft">
            Pausing hides a listing from new applications; closing ends it permanently for new
            applicants. Existing applications are always preserved.
          </p>
          <ListingLifecycleRow
            heading="Funding programmes"
            rows={(listings?.funding ?? [])
              .filter((f) => f.organization_id === orgId)
              .map((f) => ({ id: f.id, title: f.title, status: f.status }))}
            setStatus={(id, status) => updateFundingOpportunity(id, { status: status as FundingOpportunity["status"] })}
            onError={setError}
            qk={["orgListings", orgId]}
          />
          {/* B9 funder side — applications per funding programme + decisions. */}
          {(listings?.funding ?? []).filter((f) => f.organization_id === orgId).map((f) => (
            <FundingApplicationsPanel key={f.id} fundingId={f.id} title={f.title} />
          ))}
          <ListingLifecycleRow
            heading="Opportunities"
            rows={(listings?.jobs ?? [])
              .filter((j) => j.organization_id === orgId)
              .map((j) => ({ id: j.id, title: j.title, status: j.status }))}
            setStatus={(id, status) => updateOpportunity(id, { status: status as JobOpportunity["status"] })}
            onError={setError}
            qk={["orgListings", orgId]}
          />
        </div>
      )}
    </div>
  );
}

/** B9 (funder side) — applications to one funding programme with decision a
 * select. RLS: the funder org's admins decide; applicants can never self-approve. */
function FundingApplicationsPanel({ fundingId, title }: { fundingId: string; title: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: apps, isLoading } = useQuery({
    queryKey: ["fundingApplications", fundingId],
    queryFn: () => listFundingApplications(fundingId),
  });
  return (
    <Card className="p-4">
      <p className="text-[13px] font-semibold">Applications — {title}</p>
      {isLoading ? (
        <p className="mt-2 text-[12.5px] text-ink-soft">Loading applications…</p>
      ) : (apps ?? []).length === 0 ? (
        <p className="mt-2 text-[12.5px] text-ink-soft">No applications yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {(apps ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px]">
              <span className="min-w-0">
                <strong className="font-semibold">{a.profile?.full_name ?? "Applicant"}</strong>
                <p className="mt-0.5 text-[12px] text-ink-soft">{a.pitch}</p>
                {a.requested_amount != null && (
                  <p className="text-[12px] text-ink-soft">Requested Rs. {a.requested_amount.toLocaleString("en-IN")}</p>
                )}
              </span>
              <Select
                aria-label="Funding application decision"
                className="w-32 text-[11.5px]"
                value={a.status}
                onChange={async (e) => {
                  try {
                    await decideFundingApplication(a.id, e.target.value as "submitted" | "under_review" | "approved" | "declined");
                    await qc.invalidateQueries({ queryKey: ["fundingApplications", fundingId] });
                  } catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
                }}
              >
                {["submitted", "under_review", "approved", "declined"].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="mt-2"><ErrorBanner message={error} /></div>}
    </Card>
  );
}

/** B10 — pause/close controls. Only valid transitions are offered: open →
 * paused/closed, paused → open/closed, and closed is terminal (no reopening a
 * closed listing — the database check constraints only allow open/paused/closed). */
function ListingLifecycleRow({
  heading, rows, setStatus, onError, qk,
}: {
  heading: string;
  rows: { id: string; title: string; status: string }[];
  setStatus: (id: string, status: "open" | "paused" | "closed") => Promise<void>;
  onError: (s: string) => void;
  qk: readonly unknown[];
}) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [closing, setClosing] = useState<{ id: string; title: string } | null>(null);
  return (
    <Card className="p-4">
      <p className="text-[13px] font-semibold">{heading}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-ink-soft">Nothing here yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px]">
              <span className="min-w-0">
                <strong className="font-semibold">{r.title}</strong>
                <span className="ml-2 text-[12px] text-ink-soft">({titleize(r.status)})</span>
              </span>
              {r.status !== "closed" ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  {r.status !== "paused" && (
                    <Button size="sm" variant="secondary" loading={busyId === r.id}
                      onClick={async () => {
                        setBusyId(r.id);
                        try { await setStatus(r.id, "paused"); await qc.invalidateQueries({ queryKey: qk }); }
                        catch (e) { onError(errMessage(e)); }
                        finally { setBusyId(null); }
                      }}
                    >
                      Pause
                    </Button>
                  )}
                  {r.status === "paused" && (
                    <Button size="sm" variant="secondary" loading={busyId === r.id}
                      onClick={async () => {
                        setBusyId(r.id);
                        try { await setStatus(r.id, "open"); await qc.invalidateQueries({ queryKey: qk }); }
                        catch (e) { onError(errMessage(e)); }
                        finally { setBusyId(null); }
                      }}
                    >
                      Reopen
                    </Button>
                  )}
                  <Button size="sm" variant="danger" loading={busyId === r.id}
                    onClick={() => setClosing({ id: r.id, title: r.title })}
                  >
                    Close
                  </Button>
                </span>
              ) : (
                <Badge tone="neutral">Closed</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={closing !== null}
        title={`Close “${closing?.title ?? "listing"}”?`}
        description="The listing will no longer accept applications. Existing applications will be kept."
        confirmLabel="Close listing"
        destructive
        onCancel={() => setClosing(null)}
        onConfirm={async () => {
          if (!closing) return;
          const row = closing;
          setClosing(null);
          setBusyId(row.id);
          try { await setStatus(row.id, "closed"); await qc.invalidateQueries({ queryKey: qk }); }
          catch (e) { onError(errMessage(e)); }
          finally { setBusyId(null); }
        }}
      />
    </Card>
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

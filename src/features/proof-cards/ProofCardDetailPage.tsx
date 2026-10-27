import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCard,
  updateCard,
  setCardSkills,
  errMessage,
  writeAuditLog,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Field, InfoNote, Input, LoadingBlock, PageTitle, Select, SuccessBanner, Textarea, ButtonLink } from "../../components/ui";
import { canSetTier, isPubliclyVisible } from "../../lib/rbac";
import type { AppRole } from "../../types/database";
import { formatDate, titleize } from "../../lib/utils";

export default function ProofCardDetailPage() {
  const { proofCardId } = useParams();
  const { user, roles } = useAuth();
  const qc = useQueryClient();

  const { data: card, isLoading, error } = useQuery({
    queryKey: ["card", proofCardId],
    queryFn: () => fetchCard(proofCardId!),
    enabled: !!proofCardId && !!user,
  });

  if (isLoading) return <LoadingBlock />;

  if (error || !card) {
    return (
      <EmptyState
        title="Proof Card not found or not accessible"
        description="Draft and unapproved cards are private. Ask your facilitator if you should have access."
        action={<ButtonLink to="/app" size="sm" variant="secondary">Back to dashboard</ButtonLink>}
      />
    );
  }

  const team = card.team as { id: string; name: string; problem: { title: string; owner_name: string | null } | null } | null;

  return (
    <div className="space-y-6">
      <PageTitle title={card.title} sub={`Team: ${team?.name ?? "—"} · created ${formatDate(card.created_at)}`} />
      <StateRow card={card} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Problem investigated">
          <p className="font-semibold text-[14px]">{card.problem_title}</p>
          <p className="text-[13.5px] text-ink-soft">{card.problem_summary}</p>
        </Section>
        <Section title="Validation summary">
          <p className="text-[13.5px]">{card.validation_summary}</p>
        </Section>
        <Section title="Feasibility findings">
          <p className="text-[13.5px]">{card.feasibility_summary || "Not recorded."}</p>
        </Section>
        <Section title="What was built or tested">
          <p className="text-[13.5px]">{card.built_summary || "Nothing built — this Proof Card records validation work only."}</p>
        </Section>
        <Section title="Actual results & limitations">
          <p className="text-[13.5px]">{card.results_limitations || "Not recorded."}</p>
        </Section>
        <Section title="Skills demonstrated (with evidence)">
          {(card.skills ?? []).length === 0 ? (
            <p className="text-[13.5px] text-ink-soft">No skills recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {card.skills.map((s) => (
                <li key={s.id} className="rounded-lg border border-line bg-canvas p-2.5 text-[13px]">
                  <span className="font-semibold">{s.skill}</span>
                  <p className="mt-0.5 text-ink-soft">{s.evidence_summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {card.reviewer_notes && (
        <Card className="p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">Reviewer feedback</p>
          <p className="mt-1 text-[13.5px]">{card.reviewer_notes}</p>
        </Card>
      )}

      <WorkflowPanels card={card} userId={user!.id} roles={roles} qc={qc} />

      <InfoNote>
        Contribution detail (who did what) is recorded via team membership and evidence records —
        not added to public pages. Public cards show the team name only.
      </InfoNote>
    </div>
  );
}

function StateRow({ card }: { card: Awaited<ReturnType<typeof fetchCard>> }) {
  if (!card) return null;
  const isPublic = isPubliclyVisible(card);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-canvas px-4 py-3">
      <Badge tone={card.tier >= 2 ? "success" : "neutral"}>
        Tier {card.tier} — {card.tier === 1 ? "self-reported" : card.tier === 2 ? "evidence reviewed" : "confirmed by problem owner"}
      </Badge>
      <ReviewBadge status={card.review_status} />
      <Badge tone={isPublic ? "brand" : "neutral"}>{isPublic ? "Publicly visible" : "Private"}</Badge>
      <span className="text-[12px] text-ink-soft">
        Last updated {formatDate(card.updated_at)}
      </span>
    </div>
  );
}

export function ReviewBadge({ status }: { status: string }) {
  const tone =
    status === "approved" ? "success" : status === "published" ? "success" : status === "changes_requested" ? "warn" : status === "rejected" ? "danger" : "neutral";
  return <Badge tone={tone as "success" | "warn" | "danger" | "neutral"}>{titleize(status)}</Badge>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">{title}</p>
      <div className="mt-2">{children}</div>
    </Card>
  );
}

function WorkflowPanels({
  card,
  userId,
  roles,
  qc,
}: {
  card: NonNullable<Awaited<ReturnType<typeof fetchCard>>>;
  userId: string;
  roles: AppRole[];
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const isTeamEditable = card.review_status === "draft" || card.review_status === "changes_requested";
  const isStaff = canSetTier(roles);
  const isPlatformAdmin = roles.includes("platform_admin");

  const act = useMutation({
    mutationFn: async (payload: { values: Record<string, unknown>; note?: boolean }) => {
      await updateCard(card.id, payload.values);
      return payload;
    },
    onSuccess: async (p) => {
      setErr(null);
      if (p.note) {
        await writeAuditLog(userId, "proof_card.update", "proof_card", card.id, p.values);
      }
      await qc.invalidateQueries({ queryKey: ["card", card.id] });
    },
    onError: (e) => setErr(errMessage(e)),
  });

  const ownerName: string | null = card.team?.problem?.owner_name ?? null;

  return (
    <div className="space-y-5">
      {err && <ErrorBanner message={err} />}
      {okMsg && <SuccessBanner message={okMsg} />}

      {isTeamEditable && (
        <Card>
          <CardHeader title="Team actions" sub="Edit, submit for review, add skills." />
          <div className="px-5 pb-5">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  try {
                    await act.mutateAsync({ values: { review_status: "submitted" }, note: true });
                    setOkMsg("Submitted for review.");
                  } catch {
                    /* handled */
                  }
                }}
                loading={act.isPending}
              >
                Submit for review
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isTeamEditable && (
        <Card>
          <CardHeader title="Add a demonstrated skill" sub="Skill + the evidence that supports it. Be honest — weak evidence ends up evidently weak." />
          <div className="px-5 pb-5">
            <SkillForm cardId={card.id} />
          </div>
        </Card>
      )}

      {isStaff && (
        <Card>
          <CardHeader title="Reviewer actions (authorised staff)" sub="Only authorised facilitators/mentors can set tiers. Self-promotion is blocked by database policy." />
          <div className="px-5 pb-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Verification tier">
                <Select
                  value={String(card.tier)}
                  onChange={async (e) => {
                    try {
                      const tier = Number(e.target.value) as 1 | 2 | 3;
                      await act.mutateAsync({ values: { tier, tier_set_by: userId }, note: true });
                      setOkMsg(`Tier set to ${tier}. Tier 3 requires the problem owner to confirm the record separately.`);
                    } catch {
                      /* handled */
                    }
                  }}
                >
                  <option value="1">Tier 1 — self-reported</option>
                  <option value="2">Tier 2 — evidence reviewed by authorised facilitator/mentor</option>
                  <option value="3">Tier 3 — confirmed by problem owner/sponsor</option>
                </Select>
              </Field>
              <Field label="Review outcome">
                <Select
                  value={card.review_status === "submitted" ? "" : card.review_status}
                  onChange={async (e) => {
                    const v = e.target.value as typeof card.review_status;
                    if (!v) return;
                    await act.mutateAsync({ values: { review_status: v }, note: true });
                  }}
                >
                  <option value="">Choose…</option>
                  <option value="approved">Approve (eligible for publication by institution admin)</option>
                  <option value="changes_requested">Request changes</option>
                  <option value="rejected">Reject</option>
                </Select>
              </Field>
            </div>
            <div className="mt-3">
              <FeedbackSave cardId={card.id} initial={card.reviewer_notes ?? ""} onSaved={(m) => setOkMsg(m)} userId={userId} />
            </div>
          </div>
        </Card>
      )}

      {(isPlatformAdmin || isStaff) && (
        <Card>
          <CardHeader title="Problem owner confirmation (Tier 3)" sub="A problem owner confirms delivered work. This is a real person, not an automatic status." />
          <div className="px-5 pb-5 flex flex-wrap items-center gap-2">
            {ownerName ? (
              <span className="text-[13px] text-ink-soft">
                Problem owner listed: <strong className="text-ink">{ownerName}</strong>.
                Owners record confirmation through their own account or offline, then the reviewer sets Tier 3 with a note.
              </span>
            ) : (
              <span className="text-[13px] text-ink-soft">No problem owner linked to this team's problem — Tier 3 confirmation requires one.</span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function FeedbackSave({ cardId, initial, onSaved, userId }: { cardId: string; initial: string; onSaved: (m: string) => void; userId: string }) {
  const [val, setVal] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <div className="flex-1">
        <Field label="Feedback message">
          <Textarea rows={2} value={val} onChange={(e) => setVal(e.target.value)} />
        </Field>
      </div>
      <Button
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await updateCard(cardId, { reviewer_notes: val.trim() || null });
            await writeAuditLog(userId, "proof_card.feedback", "proof_card", cardId, { note: val });
            onSaved("Feedback saved.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save feedback
      </Button>
    </div>
  );
}

function SkillForm({ cardId }: { cardId: string }) {
  const qc = useQueryClient();
  const [skill, setSkill] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = skill.trim().length >= 2 && evidence.trim().length >= 4;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Skill">
        <Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. User interviewing" />
      </Field>
      <Field label="Evidence (what shows it)">
        <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="e.g. 6 recorded consented interviews" />
      </Field>
      <div className="sm:col-span-2">
        <Button
          loading={busy}
          disabled={!valid}
          onClick={async () => {
            setBusy(true);
            try {
              const existing = await fetchCard(cardId);
              await setCardSkills(cardId, [
                ...(existing?.skills ?? []).map((s) => ({ skill: s.skill, evidence_summary: s.evidence_summary })),
                { skill: skill.trim(), evidence_summary: evidence.trim() },
              ]);
              setSkill("");
              setEvidence("");
              await qc.invalidateQueries({ queryKey: ["card", cardId] });
            } finally {
              setBusy(false);
            }
          }}
        >
          Add skill
        </Button>
      </div>
    </div>
  );
}


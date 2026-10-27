import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listProblems,
  listAuditLogs,
  listRoles,
  grantRole,
  revokeRole,
  findUserIdByEmail,
  createInstitution,
  listAllCardsForReview,
  updateCard,
  errMessage,
  writeAuditLog,
} from "../../lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingBlock,
  PageTitle,
  Select,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { StatusBadge } from "../problems/ProblemsPage";
import { titleize } from "../../lib/utils";
import type { AppRole, ProofCard, Problem } from "../../types/database";

const GRANTABLE: AppRole[] = [
  "facilitator",
  "mentor",
  "faculty_coordinator",
  "institution_admin",
  "platform_admin",
  "problem_owner",
  "student",
];

export default function AdminPage() {
  const { user } = useAuth();
  const [err] = useState<string | null>(null);

  return (
    <div>
      <PageTitle
        title="Platform administration"
        sub="Platform admins only. Actions here are role-scoped by database policies and recorded in the audit log."
      />
      {err && <ErrorBanner message={err} />}
      <div className="space-y-6">
        <ProblemScreeningPanel />
        <ProofCardAdminPanel />
        <RolesPanel currentUserId={user?.id ?? ""} />
        <InstitutionsPanel />
        <AuditLogPanel />
      </div>
    </div>
  );
}

/* --------------------------- problem screening ---------------------------- */

function ProblemScreeningPanel() {
  const { data: problems, isLoading } = useQuery({ queryKey: ["problems"], queryFn: listProblems });
  if (isLoading) return <LoadingBlock label="Loading problem submissions…" />;
  return (
    <Card>
      <CardHeader title="Problem submissions" sub="All submitted problems — screen before approval. Students see only approved ones." />
      <div className="px-5 pb-5">
        {(problems ?? []).length === 0 ? (
          <EmptyState title="No submissions yet" />
        ) : (
          <ul className="space-y-3">
            {(problems ?? []).map((p: Problem) => (
              <li key={p.id} className="rounded-lg border border-line bg-canvas p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={p.status} />
                  <span className="text-[13.5px] font-semibold">{titleize(p.title)}</span>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-soft">
                  {titleize(p.category)} · affected: {p.affected_users}
                  {p.owner_contact ? ` · contact: ${p.owner_contact}` : ""}
                </p>
                <p className="mt-1 text-[12.5px]">{p.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* --------------------------- proof cards admin ---------------------------- */

function ProofCardAdminPanel() {
  const { data: cards, isLoading } = useQuery({ queryKey: ["allCards"], queryFn: listAllCardsForReview });
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  if (isLoading) return <LoadingBlock />;
  return (
    <Card>
      <CardHeader
        title="Proof Cards"
        sub="Approve or reject submitted cards; publish approved cards (public pages show only approved+published cards)."
      />
      <div className="px-5 pb-5">
        {msg && <p className="mb-2 text-[12.5px] font-semibold text-success">{msg}</p>}
        {(cards ?? []).length === 0 ? (
          <EmptyState title="No Proof Cards yet" />
        ) : (
          <ul className="space-y-3">
            {(cards ?? []).map((c: ProofCard) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={c.tier >= 2 ? "success" : "neutral"}>Tier {c.tier}</Badge>
                    <Badge tone={c.visibility === "public" ? "brand" : "neutral"}>{c.visibility}</Badge>
                    <Badge tone={c.review_status === "approved" ? "success" : c.review_status === "rejected" ? "danger" : c.review_status === "changes_requested" ? "warn" : "neutral"}>
                      {titleize(c.review_status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold">{titleize(c.title)}</p>
                  <p className="text-[12px] text-ink-soft">team {c.team_id.slice(0, 8)}… · {titleize(c.problem_title)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.review_status === "submitted" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await updateCard(c.id, { review_status: "approved" });
                          await writeAuditLog(null, "proof_card.approve", "proof_card", c.id);
                          await qc.invalidateQueries();
                          setMsg("Card approved.");
                        } catch (e) {
                          setMsg(errMessage(e));
                        }
                      }}
                    >
                      Approve
                    </Button>
                  )}
                  {c.review_status === "approved" && c.visibility !== "public" && (
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={async () => {
                        try {
                          await updateCard(c.id, { visibility: "public", review_status: "published" });
                          await writeAuditLog(null, "proof_card.publish", "proof_card", c.id);
                          await qc.invalidateQueries();
                          setMsg("Card published publicly. Verify it only exposes non-private summaries.");
                        } catch (e) {
                          setMsg(errMessage(e));
                        }
                      }}
                    >
                      Publish publicly
                    </Button>
                  )}
                  {c.visibility === "public" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await updateCard(c.id, { visibility: "private", review_status: "approved" });
                          await qc.invalidateQueries();
                          setMsg("Card unpublished.");
                        } catch (e) {
                          setMsg(errMessage(e));
                        }
                      }}
                    >
                      Unpublish
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------ roles panel ------------------------------- */

function RolesPanel({ currentUserId }: { currentUserId: string }) {
  const { data: roles, isLoading } = useQuery({ queryKey: ["roles"], queryFn: () => listRoles() });
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("facilitator");
  const [institutionId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        title="Role management"
        sub="Grant or revoke elevated roles. Users cannot self-assign these — signup only permits student or problem owner."
      />
      <div className="border-t border-line px-5 py-4">
        {ok && <p className="mb-2 text-[12.5px] font-semibold text-success">{ok}</p>}
        {error && <div className="mb-2"><ErrorBanner message={error} /></div>}
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" type="email" placeholder="_assignee@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select className="max-w-[190px]" value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
            {GRANTABLE.map((r) => (
              <option key={r} value={r}>{titleize(r)}</option>
            ))}
          </Select>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              setOk(null);
              try {
                const uid = await findUserIdByEmail(email.trim().toLowerCase());
                if (!uid) {
                  setError("No BuildProof account for that email. The person must sign up first.");
                  return;
                }
                if (uid === currentUserId && ["platform_admin", "institution_admin"].includes(role)) {
                  setError("Do not grant yourself an elevated role — ask another admin.");
                  return;
                }
                await grantRole(uid, role, institutionId || null, currentUserId);
                await writeAuditLog(currentUserId, "role.grant", "user", uid, { role, institutionId });
                setOk(`Role ${role} granted to user ${uid.slice(0, 8)}… form details appear in the roles list.`);
                setEmail("");
                await qc.invalidateQueries({ queryKey: ["roles"] });
              } catch (e) {
                setError(errMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Grant role
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-ink-soft">
          Forbidden: granting roles to yourself. Prevented in code and flagged in your security
          review checklist — the database is the real boundary.
        </p>
      </div>
      <div className="border-t border-line px-5 py-4">
        {isLoading ? (
          <LoadingBlock />
        ) : (
          <ul className="space-y-2">
            {(roles ?? []).map((r) => (
              <li key={`${r.user_id}-${r.role}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px]">
                <div>
                  <p className="font-semibold">{r.profile?.full_name ?? "(no profile)"}</p>
                  <p className="text-[11.5px] text-ink-soft">{titleize(r.role)}{r.institution_id ? ` · institution ${r.institution_id.slice(0, 8)}…` : ""}</p>
                </div>
                <button
                  className="text-[12px] font-semibold text-danger hover:underline"
                  onClick={async () => {
                    try {
                      await revokeRole(r.user_id, r.role);
                      await qc.invalidateQueries({ queryKey: ["roles"] });
                    } catch (e) {
                      setError(errMessage(e));
                    }
                  }}
                >
                  Revoke
                </button>
              </li>
            ))}
            {(roles ?? []).length === 0 && <p className="text-[13px] text-ink-soft">No roles granted yet.</p>}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* --------------------------- institutions panel --------------------------- */

function InstitutionsPanel() {
  const { data } = useQuery({ queryKey: ["institutions"], queryFn: () => listProblems() });
  void data;
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title="Register an institution" sub="Platform admins add institutions by name + city only. No claims about real partnerships." />
      <div className="border-t border-line px-5 py-4">
        {okMsg && <p className="mb-2 text-[12.5px] font-semibold text-success">{okMsg}</p>}
        {err && <div className="mb-2"><ErrorBanner message={err} /></div>}
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Institution name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="max-w-[180px]" placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
          <Button
            loading={busy}
            disabled={name.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await createInstitution(name.trim(), city.trim() || null);
                setOkMsg("Institution registered. Assign an institution_admin role to people who run cohorts there.");
                setName("");
                setCity("");
              } catch (e) {
                setErr(errMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Register
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ audit log -------------------------------- */

function AuditLogPanel() {
  const { data: logs, isLoading } = useQuery({ queryKey: ["auditLogs"], queryFn: listAuditLogs });
  return (
    <Card>
      <CardHeader title="Audit log (last 100)" sub="Important administrative actions." />
      <div className="border-t border-line px-5 py-4">
        {isLoading ? (
          <LoadingBlock />
        ) : (logs ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-soft">No audit entries yet.</p>
        ) : (
          <ul className="space-y-1.5 text-[12px] text-ink-soft">
            {(logs ?? []).map((l) => (
              <li key={l.id} className="flex flex-wrap gap-2">
                <code className="rounded bg-canvas px-1">{l.action}</code>
                <span>{l.entity} {l.entity_id?.slice(0, 8)}…</span>
                <span className="ml-auto">{new Date(l.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

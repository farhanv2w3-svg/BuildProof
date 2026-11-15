import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyCohorts, fetchCohortTeams, listMyHardware, createHardwareProject, updateHardwareProject } from "../../lib/api";
import type { HardwareProject, Team, HardwareBOMItem } from "../../types/database";
import {
  Button, Card, EmptyState, ErrorBanner, Field, Input, LoadingBlock, Select, Textarea,
} from "../../components/ui";
import { DemoCard, StatusBadge } from "../../components/DomainKit";
import { demoHardwareProject } from "../../lib/demoData";
import { useAuth } from "../../lib/auth";

export default function MyHardwarePage() {
  const { user } = useAuth();

  const { data: cohorts, isLoading: cLoading } = useQuery({
    queryKey: ["cohorts", user?.id],
    queryFn: () => listMyCohorts(user!.id),
    enabled: !!user,
  });

  // Flatten my teams out of my cohorts (same pattern the dashboard uses).
  const { data: teams } = useQuery({
    queryKey: ["teamsForHardware", cohorts?.map((c) => c.id).join(",")],
    queryFn: async () => {
      const ids = (cohorts ?? []).map((c) => c.id);
      const all: Team[] = [];
      for (const id of ids) all.push(...(await fetchCohortTeams(id)));
      return all;
    },
    enabled: (cohorts ?? []).length > 0,
  });

  const teamIds = (teams ?? []).map((t) => t.id);
  const { data: hardware } = useQuery({
    queryKey: ["hardware", teamIds.join(",")],
    queryFn: () => listMyHardware(teamIds),
    enabled: teamIds.length > 0,
  });

  if (cLoading) return <LoadingBlock />;

  const rows = (hardware ?? []) as HardwareProject[];

  return (
    <div>
      <div className="mb-5">
        <h1 className="display-title text-2xl">Hardware projects</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">
          Register a physical build for one of your teams. Records stay private to the team and its reviewers —
          a funding interest never makes a prototype production-ready.
        </p>
      </div>

      {teamIds.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Hardware projects belong to teams. Join or create a team first."
          action={<Link to="/app" className="text-[13px] font-semibold text-brand-700">Back to dashboard</Link>}
        />
      ) : (
        rows.length === 0 ? (
          <EmptyState
            title="No hardware registered yet"
            description="Register a concept at any stage of the 12-stage pathway."
            action={<Card className="mt-3 w-full max-w-xl p-4"><HardwareForm teamIds={teamIds} defaultTeamId={teamIds[0] ?? null} /></Card>}
          />
        ) : (
          <div className="space-y-4">
            <Card className="p-5"><HardwareForm teamIds={teamIds} defaultTeamId={teamIds[0] ?? null} /></Card>
            {rows.map((h) => <HardwareRow key={h.id} row={h} />)}
          </div>
        )
      )}

      <div className="mt-10 max-w-2xl rounded-xl border border-line p-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">Example record</p>
        <div className="mt-2"><DemoCard demo={demoHardwareProject} compact /></div>
      </div>
    </div>
  );
}

function HardwareRow({ row }: { row: HardwareProject }) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-ink">{row.name}</h2>
          <p className="text-[12.5px] text-ink-soft">Stage {row.current_stage} of 12 · {row.readiness_class.replace(/_/g, " ")} · IP: {row.ip_status.replace(/_/g, " ")}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={row.readiness_class} />
          <Select
            aria-label={`Visibility for ${row.name}`}
            className="w-36 text-[11.5px]"
            value={row.visibility ?? "private"}
            onChange={async (e) => {
              const visibility = e.target.value as "private" | "restricted" | "public";
              try {
                await updateHardwareProject(row.id, { visibility, published_at: visibility === "public" ? new Date().toISOString() : null });
                await qc.invalidateQueries({ queryKey: ["hardware"] });
              } catch (err2) { setErr(err2 instanceof Error ? err2.message : "Failed."); }
            }}
          >
            <option value="private">Private</option>
            <option value="restricted">Restricted</option>
            <option value="public">Public</option>
          </Select>
          <Select
            aria-label={`Advance stage for ${row.name}`}
            className="w-40 text-[11.5px]"
            value={String(row.current_stage)}
            onChange={async (e) => {
              try { await updateHardwareProject(row.id, { current_stage: Number(e.target.value) }); await qc.invalidateQueries({ queryKey: ["hardware"] }); }
              catch (err2) { setErr(err2 instanceof Error ? err2.message : "Failed."); }
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Stage {n}</option>)}
          </Select>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-ink-soft">{row.description}</p>
      {row.safety_considerations && <p className="mt-1 text-[12.5px] text-ink-soft"><strong>Safety:</strong> {row.safety_considerations}</p>}
      {row.incomplete_work && <p className="mt-1 text-[12.5px] text-ink-soft"><strong>Remaining:</strong> {row.incomplete_work}</p>}
      {row.bom.length > 0 && (
        <div className="mt-2">
          <h3 className="text-[12px] font-bold text-ink">Bill of materials</h3>
          <ul className="mt-1 grid gap-x-6 gap-y-1 text-[12px] text-ink-soft sm:grid-cols-2">
            {row.bom.map((b: HardwareBOMItem, i: number) => (
              <li key={i} className="flex justify-between gap-3 border-b border-line/60 py-0.5">
                <span>{b.item} × {b.qty}</span>
                <span>₹{b.unit_cost}</span>
              </li>
            ))}
          </ul>
          {row.cost_note && <p className="mt-1 text-[11.5px] text-ink-soft">Cost assumptions: {row.cost_note}</p>}
        </div>
      )}
      {err && <div className="mt-2"><ErrorBanner message={err} /></div>}
    </Card>
  );
}

function HardwareForm({ teamIds, defaultTeamId }: { teamIds: string[]; defaultTeamId: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const firstTeam = teamIds[0] ?? "";
  const [teamSel, setTeamSel] = useState(defaultTeamId ?? firstTeam);
  const [f, setF] = useState({
    name: "", description: "", problem_statement: "", stage: "1", specs: "",
    bom: "", cost_note: "", safety: "", evidence_note: "", incomplete_work: "",
    demo_url: "", readiness: "prototype", ip: "undecided",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          if (f.name.trim().length < 4 || f.description.trim().length < 20)
            throw new Error("Name needs 4+ characters and description 20+.");
          const stage = Math.min(12, Math.max(1, Number(f.stage) || 1));
          // Spec + BOM are line-based, so nothing learned is lost to a complex editor.
          const specs = f.specs.split("\n").map((l) => {
            const [k, ...v] = l.split(":");
            return k?.trim() && v.length > 0 ? { spec: k.trim(), value: v.join(":").trim() } : null;
          }).filter(Boolean) as { spec: string; value: string }[];
          const bom = f.bom.split("\n").map((l) => {
            // "item, qty, unit cost"
            const parts = l.split(",").map((p) => p.trim());
            if (parts.length < 3 || !parts[0]) return null;
            return { item: parts[0], qty: Math.max(1, Number(parts[1]) || 1), unit_cost: Math.max(0, Number(parts[2]) || 0) };
          }).filter(Boolean) as HardwareBOMItem[];
          await createHardwareProject({
            team_id: teamSel,
            name: f.name.trim(),
            description: f.description.trim(),
            problem_statement: f.problem_statement.trim() || null,
            current_stage: stage,
            specs,
            bom,
            cost_currency: "INR",
            cost_note: f.cost_note.trim() || null,
            safety_considerations: f.safety.trim() || null,
            evidence_note: f.evidence_note.trim() || null,
            incomplete_work: f.incomplete_work.trim() || null,
            demo_url: f.demo_url.trim() || null,
            readiness_class: f.readiness as HardwareProject["readiness_class"],
            ip_status: f.ip as HardwareProject["ip_status"],
            created_by: user!.id,
          });
          setF({ ...f, name: "", description: "", problem_statement: "", specs: "", bom: "", cost_note: "", safety: "", evidence_note: "", incomplete_work: "", demo_url: "" });
          await qc.invalidateQueries({ queryKey: ["hardware"] });
        } catch (err2) {
          setError(err2 instanceof Error ? err2.message : "Could not register project.");
        } finally { setBusy(false); }
      }}
    >
      <Field label="Team">
        <Select value={teamSel} onChange={(e) => setTeamSel(e.target.value)}>
          {teamIds.map((id) => <option key={id} value={id}>{id.slice(0, 8)}…</option>)}
        </Select>
      </Field>
      <Field label="Current stage (of the 12-stage pathway)">
        <Input type="number" min={1} max={12} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })} />
      </Field>
      <Field label="Project name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={4} maxLength={180} /></Field>
      <Field label="Readiness class">
        <Select value={f.readiness} onChange={(e) => setF({ ...f, readiness: e.target.value })}>
          {["concept", "prototype", "near_complete", "production_candidate"].map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </Select>
      </Field>
      <div className="sm:col-span-2"><Field label="Description (intended use, what it is)"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} required minLength={20} maxLength={4000} /></Field></div>
      <div className="sm:col-span-2"><Field label="Problem it solves"><Textarea value={f.problem_statement} onChange={(e) => setF({ ...f, problem_statement: e.target.value })} rows={2} maxLength={1500} /></Field></div>
      <div className="sm:col-span-2"><Field label="Specifications (one per line — 'label: value')"><Textarea value={f.specs} onChange={(e) => setF({ ...f, specs: e.target.value })} rows={2} maxLength={2000} placeholder="supply voltage: 12V&#10;valve outputs: 2" /></Field></div>
      <div className="sm:col-span-2"><Field label="Bill of materials (one per line — 'item, qty, unit cost ₹')"><Textarea value={f.bom} onChange={(e) => setF({ ...f, bom: e.target.value })} rows={3} maxLength={3000} placeholder="ESP32 dev board, 1, 420&#10;12V solenoid valve, 2, 350" /></Field></div>
      <Field label="Cost assumptions note"><Input value={f.cost_note} onChange={(e) => setF({ ...f, cost_note: e.target.value })} maxLength={500} /></Field>
      <Field label="IP status">
        <Select value={f.ip} onChange={(e) => setF({ ...f, ip: e.target.value })}>
          {["undecided", "student_owned", "licensed", "transferred"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </Select>
      </Field>
      <div className="sm:col-span-2"><Field label="Safety considerations (required for hardware)"><Textarea value={f.safety} onChange={(e) => setF({ ...f, safety: e.target.value })} rows={2} required maxLength={1500} /></Field></div>
      <div className="sm:col-span-2"><Field label="Test evidence note (what was measured, where recorded)"><Textarea value={f.evidence_note} onChange={(e) => setF({ ...f, evidence_note: e.target.value })} rows={2} maxLength={1000} /></Field></div>
      <div className="sm:col-span-2"><Field label="Remaining / incomplete work"><Textarea value={f.incomplete_work} onChange={(e) => setF({ ...f, incomplete_work: e.target.value })} rows={2} maxLength={2000} /></Field></div>
      <Field label="Demo URL (optional)"><Input value={f.demo_url} onChange={(e) => setF({ ...f, demo_url: e.target.value })} maxLength={300} /></Field>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" loading={busy}>Register project</Button>
        {error && <span className="text-[12.5px] text-danger" role="alert">{error}</span>}
      </div>
    </form>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus } from "lucide-react";
import {
  createCohort,
  fetchInstitutions,
  listRoles,
} from "../../lib/api";
import { Button, Card, Field, Input, PageTitle, Select, Textarea, EmptyState, ErrorBanner, SuccessBanner } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { Link } from "react-router-dom";

const cohortFormSchema = z.object({
  institution_id: z.string().min(1, "Choose an institution"),
  name: z.string().trim().min(4, "Name required (4+ chars)").max(120),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  interview_gate: z.coerce.number().int().min(1).max(50),
});

type CohortFormValues = z.infer<typeof cohortFormSchema>;

export default function InstitutionPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  // Platform admins see all institutions; institution admins see their own.
  const { data: institutions } = useQuery({
    queryKey: ["institutions", user?.id],
    queryFn: fetchInstitutions,
    enabled: !!user,
  });

  const { data: myInstitutionRoles } = useQuery({
    queryKey: ["myInstitutionRoles", user?.id],
    queryFn: () => listRoles(user!.id),
    enabled: !!user,
  });

  const myInstitutions = (myInstitutionRoles ?? [])
    .filter((r) => r.institution_id)
    .map((r) => r.institution_id!);

  const allowedInstitutions = (institutions ?? []).filter(
    (i) =>
      roles.includes("platform_admin") ||
      (roles.includes("institution_admin") && myInstitutions.includes(i.id))
  );

  const createMutation = useMutation({
    mutationFn: async (v: CohortFormValues) =>
      createCohort({
        institution_id: v.institution_id,
        name: v.name,
        description: v.description || undefined,
        interview_gate: v.interview_gate,
        created_by: user!.id,
      }),
    onSuccess: (c) => {
      setCreated(c.id);
      qc.invalidateQueries();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed to create cohort"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CohortFormValues>({
    resolver: zodResolver(cohortFormSchema),
    defaultValues: { interview_gate: 8 },
  });

  if (!user) return null;

  return (
    <div>
      <PageTitle
        title="Institution & cohorts"
        sub="Set up a cohort for an initial operating plan (e.g. one college, five teams, 20–30 students). Cohorts start in planning status."
      />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {created && (
        <div className="mb-4">
          <SuccessBanner message="Cohort created. Open it to add members and teams." />
        </div>
      )}

      <Card className="p-6">
        <h3 className="font-display font-bold">Create a new cohort</h3>
        {!isPlatformAdmin(roles) && (myInstitutions ?? []).length === 0 && (
          <div className="mt-2">
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No institution access yet"
              description={
                roles.includes("institution_admin")
                  ? "Wait for a platform admin to grant your institution role with institution_id, or register your institution (admin only)."
                  : "Only institution admins, faculty coordinators and platform admins can create cohorts — that's how BuildProof avoids self-promotion."
              }
              action={<ApplyHint />}
            />
          </div>
        )}
        {allowedInstitutions.length > 0 && (
          <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="mt-3 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Institution" required error={errors.institution_id?.message}>
                <Select {...register("institution_id")}>
                  <option value="">Choose…</option>
                  {allowedInstitutions.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Cohort name" required error={errors.name?.message} hint="e.g. “Pilot Cohort A — Semester 1”">
                <Input {...register("name")} maxLength={120} />
              </Field>
            </div>
            <Field label="Description" error={errors.description?.message}>
              <Textarea {...register("description")} rows={2} placeholder="Purpose, timeline expectations (2-week validation + optional 2-week prototype), participating departments…" />
            </Field>
            <Field
              label="Interview gate (suggested minimum)"
              required
              error={errors.interview_gate?.message}
              hint="Suggested number of consented adult interviews per team before a validation decision. 8 is the default guidance."
            >
              <Input type="number" {...register("interview_gate")} />
            </Field>
            <Button type="submit" loading={isSubmitting}>
              <Plus className="h-4 w-4" /> Create cohort
            </Button>
          </form>
        )}
      </Card>

      <p className="mt-4 text-[12.5px] text-ink-soft">
        Registering a brand-new institution is a platform-admin action (Admin page). Database
        policies keep institution administration scoped to the institution you're granted.
      </p>
    </div>
  );
}

function ApplyHint() {
  return (
    <Link to="/apply" className="mt-3 inline-block text-[13px] font-semibold text-brand-700 hover:underline">
      How institution access works →
    </Link>
  );
}

function isPlatformAdmin(roles: string[]) {
  return roles.includes("platform_admin");
}

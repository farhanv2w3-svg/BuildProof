import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { problemSchema } from "../../lib/validation";
import { submitProblem, errMessage } from "../../lib/api";
import { Button, Card, Field, Input, PageTitle, Select, Textarea, SuccessBanner, ErrorBanner } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { CATEGORY_LABELS } from "./ProblemsPage";
import { z } from "zod";

type FormValues = z.infer<typeof problemSchema>;

export function SubmitProblemForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(problemSchema) });

  const onSubmit = async (v: FormValues) => {
    setErr(null);
    try {
      await submitProblem(
        {
          title: v.title,
          description: v.description,
          category: v.category,
          affected_users: v.affected_users,
          location: v.location || undefined,
          workaround: v.workaround || undefined,
          evidence_basis: v.evidence_basis || undefined,
          owner_name: v.owner_name || undefined,
          owner_contact: v.owner_contact || undefined,
        },
        user!.id
      );
      setOk(true);
      onSuccess?.();
      setTimeout(() => nav("/app/problems"), 1800);
    } catch (e) {
      setErr(errMessage(e));
    }
  };

  if (ok) {
    return (
      <Card className="p-6">
        <SuccessBanner message="Submitted for screening. A reviewer records the decision — you'll get an in-app notification either way. Nothing is auto-approved." />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {err && <div className="mb-4"><ErrorBanner message={err} /></div>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Problem title" required error={errors.title?.message} hint="Short and specific. e.g. “College canteens have no way to predict daily demand”.">
          <Input {...register("title")} maxLength={120} />
        </Field>
        <Field label="What is the problem?" required error={errors.description?.message} hint="Who struggles, when, and what goes wrong. 50 characters minimum.">
          <Textarea {...register("description")} rows={5} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required error={errors.category?.message}>
            <Select {...register("category")} defaultValue="">
              <option value="" disabled>Choose a category…</option>
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Affected users / organisations" required error={errors.affected_users?.message} hint="Who feels this problem day to day.">
            <Input {...register("affected_users")} maxLength={400} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location (general)" error={errors.location?.message} hint="City or area only — never personal addresses.">
            <Input {...register("location")} maxLength={120} />
          </Field>
          <Field label="Current workaround" error={errors.workaround?.message} hint="How do people cope today?">
            <Input {...register("workaround")} maxLength={1000} />
          </Field>
        </div>
        <Field
          label="Evidence this matters"
          error={errors.evidence_basis?.message}
          hint="Observations, numbers you've seen, or your own experience. Be honest about what's verified vs assumed."
        >
          <Textarea {...register("evidence_basis")} rows={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Proposed problem owner" error={errors.owner_name?.message} hint="Organisation or person, if you know one.">
            <Input {...register("owner_name")} maxLength={120} />
          </Field>
          <Field label="Contact of problem owner" error={errors.owner_contact?.message} hint="Published only to authorised reviewers — never publicly.">
            <Input {...register("owner_contact")} maxLength={160} />
          </Field>
        </div>
        <p className="rounded-lg bg-canvas border border-line px-3 py-2 text-[12px] text-ink-soft">
          By submitting you confirm this is genuinely observed, free of personal contact details
          of individuals who haven't consented, and that anyone interviewed was a consenting adult.
        </p>
        <div className="flex gap-3">
          <Button type="submit" loading={isSubmitting} size="lg">Submit for screening</Button>
          <Link to="/app/problems" className="self-center text-[13px] text-ink-soft hover:text-ink">Cancel</Link>
        </div>
      </form>
    </Card>
  );
}

export default function SubmitProblemPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <PageTitle
        title="Submit a real problem"
        sub="Describe a genuine problem you have observed. A reviewer screens it before it becomes available to teams."
      />
      <SubmitProblemForm />
    </div>
  );
}

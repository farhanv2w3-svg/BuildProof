import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { proofCardSchema } from "../../lib/validation";
import { createCard, errMessage } from "../../lib/api";
import { Button, ErrorBanner, Field, Input, SuccessBanner, Textarea } from "../../components/ui";
import type { z } from "zod";

type FormValues = z.infer<typeof proofCardSchema>;

/**
 * Create a Proof Card for a team. The card starts as a private draft — it is
 * NEVER public until reviewed, approved and published by authorised staff.
 */
export function ProofCardBuilder({
  teamId,
  problemTitleHint,
}: {
  teamId: string;
  problemTitleHint?: string;
}) {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(proofCardSchema),
    defaultValues: {
      title: "",
      problem_title: problemTitleHint ?? "",
      problem_summary: "",
      validation_summary: "",
      feasibility_summary: "",
      built_summary: "",
      results_limitations: "",
    },
  });

  if (ok) {
    return <SuccessBanner message={ok} />;
  }

  return (
    <>
      {err && <ErrorBanner message={err} />}
      <form
        onSubmit={handleSubmit(async (v) => {
          setErr(null);
          try {
            await createCard({
              team_id: teamId,
              title: v.title,
              problem_title: v.problem_title,
              problem_summary: v.problem_summary,
              validation_summary: v.validation_summary,
              feasibility_summary: v.feasibility_summary || undefined,
              built_summary: v.built_summary || undefined,
              results_limitations: v.results_limitations || undefined,
            });
            setOk(
              "Proof Card created as a PRIVATE draft. Open it from your team workspace to add skills and submit it for review."
            );
            await qc.invalidateQueries({ queryKey: ["myCards"] });
          } catch (e) {
            setErr(errMessage(e));
          }
        })}
        className="space-y-4"
        noValidate
      >
        <Field label="Proof Card title" required error={errors.title?.message}>
          <Input {...register("title")} placeholder="e.g. Canteen demand prediction — validation study" />
        </Field>
        <Field label="Problem investigated (title)" required error={errors.problem_title?.message}>
          <Input {...register("problem_title")} />
        </Field>
        <Field label="Problem summary" required error={errors.problem_summary?.message}>
          <Textarea {...register("problem_summary")} rows={2} />
        </Field>
        <Field
          label="Validation summary"
          required
          error={errors.validation_summary?.message}
          hint="What the interviews actually showed. State interview counts honestly."
        >
          <Textarea {...register("validation_summary")} rows={4} />
        </Field>
        <Field label="Feasibility findings" error={errors.feasibility_summary?.message}>
          <Textarea {...register("feasibility_summary")} rows={3} />
        </Field>
        <Field
          label="What was built or tested"
          error={errors.built_summary?.message}
          hint="Leave empty if the project stopped at validation — that is a legitimate outcome."
        >
          <Textarea {...register("built_summary")} rows={3} />
        </Field>
        <Field label="Results & limitations" error={errors.results_limitations?.message} hint="Honest results — including what did NOT work.">
          <Textarea {...register("results_limitations")} rows={3} />
        </Field>
        <Button type="submit" loading={isSubmitting}>
          Create Proof Card (private draft)
        </Button>
      </form>
    </>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { profileSchema } from "../../lib/validation";
import { getSupabase } from "../../lib/supabase";
import { Button, Card, ErrorBanner, Field, Input, PageTitle, SuccessBanner, Textarea } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { z } from "zod";

type FormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { profile, user, refresh } = useAuth();
  const supabase = getSupabase();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? "",
      college: profile?.college ?? "",
      grad_year: profile?.grad_year ?? null,
      bio: profile?.bio ?? "",
    },
  });

  const onSubmit = async (v: FormValues) => {
    setErr(null);
    setOk(null);
    if (!supabase || !user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: v.full_name,
        college: v.college?.trim() || null,
        grad_year: v.grad_year ?? null,
        bio: v.bio?.trim() || null,
      })
      .eq("id", user.id);
    if (error) {
      setErr(error.message);
      return;
    }
    // A13: refresh the AuthContext so the saved profile shows everywhere
    // (landing header, dashboards) immediately — no logout/login needed.
    await refresh().catch(() => undefined);
    setOk("Profile saved.");
  };

  return (
    <div>
      <PageTitle
        title="My profile"
        sub="Your name as collaborators and reviewers will see it. This is not a public profile page — only authenticated BuildProof users see these details."
      />
      <Card className="max-w-xl p-6">
        {err && <div className="mb-4"><ErrorBanner message={err} /></div>}
        {ok && <div className="mb-4"><SuccessBanner message={ok} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Full name" required error={errors.full_name?.message}>
            <Input {...register("full_name")} />
          </Field>
          <Field label="College / Organisation" error={errors.college?.message} hint="Shown next to your name in team work.">
            <Input {...register("college")} placeholder="Optional" />
          </Field>
          <Field label="Graduation year" error={errors.grad_year?.message}>
            <Input type="number" placeholder="e.g. 2028"
              onChange={(e) => setValue("grad_year", e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <Field label="Short bio" error={errors.bio?.message}>
            <Textarea {...register("bio")} placeholder="What do you build or care about? (max 400 chars)" />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={isSubmitting}>Save profile</Button>
            <p className="text-[12px] text-ink-soft">
              Email ({user?.email}) and roles cannot be changed here.
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}

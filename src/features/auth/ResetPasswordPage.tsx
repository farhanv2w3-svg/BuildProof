import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../lib/auth";
import { getSupabase } from "../../lib/supabase";
import { resetPasswordSchema } from "../../lib/validation";
import { Button, Card, ErrorBanner, Field, Input } from "../../components/ui";
import { AuthShell, Unconfigured } from "./SignupPage";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type FormValues = z.infer<typeof resetPasswordSchema>;

/**
 * Reached via: /auth/callback exchanges the recovery code, then redirects here.
 * The recovery session is required — otherwise there is nothing to reset.
 */
export default function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const supabase = getSupabase();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(resetPasswordSchema) });

  if (!supabase) return <Unconfigured />;
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  const onSubmit = async (v: FormValues) => {
    setErr(null);
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
  };

  return (
    <AuthShell title="Choose a new password">
      <Card className="p-6">
        {err && <div className="mb-4"><ErrorBanner message={err} /></div>}
        {done ? (
          <>
            <p className="text-sm text-success-soft bg-success-soft border border-success/25 rounded-lg px-4 py-3 text-[13.5px] text-success">
              Password updated. You can now sign in with it.
            </p>
            <Button className="mt-4 w-full" onClick={() => navigate("/app")}>
              Go to my dashboard
            </Button>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="New password" required error={errors.password?.message} hint="At least 8 characters.">
              <Input {...register("password")} type="password" autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" required error={errors.confirm?.message}>
              <Input {...register("confirm")} type="password" autoComplete="new-password" />
            </Field>
            <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
              Update password
            </Button>
          </form>
        )}
      </Card>
    </AuthShell>
  );
}

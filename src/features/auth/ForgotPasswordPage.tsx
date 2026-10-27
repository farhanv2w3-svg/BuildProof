import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useState } from "react";
import { forgotPasswordSchema } from "../../lib/validation";
import { getSupabase } from "../../lib/supabase";
import { Button, Card, ErrorBanner, Field, Input, SuccessBanner } from "../../components/ui";
import { AuthShell, Unconfigured } from "./SignupPage";
import { z } from "zod";

type FormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const supabase = getSupabase();
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  if (!supabase) return <Unconfigured />;

  const onSubmit = async (v: FormValues) => {
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(v.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell title="Reset your password">
      <Card className="p-6">
        {err && <div className="mb-4"><ErrorBanner message={err} /></div>}
        {sent ? (
          <>
            <SuccessBanner message="If an account exists for that email, a password reset link has been sent. The link works only on the site listed in the Supabase redirect allowlist." />
            <p className="mt-3 text-[13px] text-ink-soft">
              Didn't receive anything? Check spam, or ask a platform administrator for help.
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Account email" required error={errors.email?.message}>
              <Input {...register("email")} type="email" autoComplete="email" placeholder="you@example.com" />
            </Field>
            <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-[13px]">
          <Link to="/login" className="text-ink-soft hover:text-ink hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { loginSchema } from "../../lib/validation";
import { getSupabase } from "../../lib/supabase";
import { Button, Card, ErrorBanner, Field, Input } from "../../components/ui";
import { AuthShell, Unconfigured } from "./SignupPage";
import { z } from "zod";

type FormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = getSupabase();
  const [err, setErr] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(loginSchema) });

  if (!supabase) return <Unconfigured />;

  const onSubmit = async (v: FormValues) => {
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: v.email,
      password: v.password,
    });
    if (error) {
      // Deliberately vague message — never reveals whether an email exists.
      setErr("Sign-in failed. Check your email and password, or confirm your email if you just signed up.");
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <AuthShell title="Sign in to BuildProof">
      <Card className="p-6">
        {err && <div className="mb-4"><ErrorBanner message={err} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Email" required error={errors.email?.message}>
            <Input {...register("email")} type="email" autoComplete="email" placeholder="you@example.com" />
          </Field>
          <Field label="Password" required error={errors.password?.message}>
            <Input {...register("password")} type="password" autoComplete="current-password" placeholder="••••••••" />
          </Field>
          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            Sign in
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between text-[13px]">
          <Link to="/forgot-password" className="text-ink-soft hover:text-ink hover:underline">
            Forgot password?
          </Link>
          <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
            Create account
          </Link>
        </div>
      </Card>
    </AuthShell>
  );
}

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { signupSchema } from "../../lib/validation";
import { getSupabase } from "../../lib/supabase";
import { Button, Card, ErrorBanner, Field, Input, Select } from "../../components/ui";
import { Logo } from "../../components/Logo";
import type { z } from "zod";

type FormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const nav = useNavigate();
  const location = useLocation();
  const supabase = getSupabase();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: "student" },
  });

  if (!supabase) {
    return <Unconfigured />;
  }

  const onSubmit = async (v: FormValues) => {
    setErr(null);
    const { error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { full_name: v.full_name, role: v.role },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
      },
    });
    if (error) {
      setErr(error.message);
      return;
    }
    setSentEmail(v.email);
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title="Check your email">
        <Card className="p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <MailCheck className="h-6 w-6" />
          </div>
          <h2 className="display-title mt-4 text-xl">Confirm your email</h2>
          <p className="mt-2 text-sm text-ink-soft">
            We sent a confirmation link to <strong className="text-ink">{sentEmail}</strong>.
            Open it on this device to finish setting up your account.
          </p>
          <p className="mt-3 text-[12px] text-ink-soft">
            Everything starts unverified: new accounts cannot grant themselves extra roles.
          </p>
          <div className="mt-5">
            <Button variant="secondary" onClick={() => nav("/login")}>
              Back to sign in
            </Button>
          </div>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your BuildProof account">
      <Card className="p-6">
        {err && <div className="mb-4"><ErrorBanner message={err} /></div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Full name" required error={errors.full_name?.message}>
            <Input {...register("full_name")} autoComplete="name" placeholder="e.g. Priya R." />
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            <Input {...register("email")} type="email" autoComplete="email" placeholder="you@example.com" />
          </Field>
          <Field
            label="Password"
            required
            error={errors.password?.message}
            hint="At least 8 characters."
          >
            <Input {...register("password")} type="password" autoComplete="new-password" placeholder="••••••••" />
          </Field>
          <Field label="I am joining as" required error={errors.role?.message}>
            <Select {...register("role")}>
              <option value="student">A student / early builder</option>
              <option value="problem_owner">A problem owner (business, NGO, startup…)</option>
            </Select>
          </Field>
          <p className="text-[12px] text-ink-soft">
            Facilitator, mentor, institution and platform roles are granted only by a
            platform administrator after real verification — never by signup.
          </p>
          <label className="flex items-start gap-2 text-[12.5px] text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-600"
              {...register("terms")}
            />
            <span>
              I agree to the{" "}
              <Link to="/terms" className="font-semibold text-brand-700 hover:underline">Terms</Link> and{" "}
              <Link to="/privacy" className="font-semibold text-brand-700 hover:underline">Privacy policy</Link>.
            </span>
          </label>
          {errors.terms && <p role="alert" className="text-[12.5px] text-danger">{errors.terms.message}</p>}
          <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-[13px] text-ink-soft">
          Already have an account?{" "}
          <Link to="/login" state={{ from }} className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
}

/* Shared auth layout */

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <Link to="/" className="mb-6" aria-label="BuildProof home">
        <Logo />
      </Link>
      <h1 className="display-title mb-5 text-xl sm:text-2xl text-center">{title}</h1>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export function Unconfigured() {
  return (
    <AuthShell title="Backend not configured">
      <Card className="p-6">
        <ErrorBanner message="The BuildProof Supabase project is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file (see .env.example), then restart the dev server." />
      </Card>
    </AuthShell>
  );
}

import Link from "next/link";
import AuthShell from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      description="One sign-in works for both passengers and drivers. We’ll send you to the right workspace for your account."
      eyebrow="Welcome back"
      footer={
        <p>
          New here? <Link href="/register">Create an account</Link>.
        </p>
      }
      title="Your next ride starts here."
    >
      <LoginForm />
    </AuthShell>
  );
}

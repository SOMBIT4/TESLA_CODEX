import Link from "next/link";
import AuthShell from "@/components/auth/auth-shell";
import RegisterForm from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      description="Choose how you’ll use Bullet: share a ride as a passenger or drive your own pool through Dhaka."
      eyebrow="New account"
      footer={
        <p>
          Already registered? <Link href="/login">Sign in</Link>.
        </p>
      }
      title="Make your next ride easier."
    >
      <RegisterForm />
    </AuthShell>
  );
}

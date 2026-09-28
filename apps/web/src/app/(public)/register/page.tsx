import Link from "next/link";
import RegisterForm from "@/components/auth/register-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">
            Dhaka Tesla Pool
          </p>
          <CardTitle className="mt-2 text-3xl">Create your account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Start with a clear fare estimate before you travel.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mt-8">
            <RegisterForm />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Already registered? <Link href="/login">Sign in</Link>.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

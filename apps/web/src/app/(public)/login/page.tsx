import Link from "next/link";
import LoginForm from "@/components/auth/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">
            Dhaka Tesla Pool
          </p>
          <CardTitle className="mt-2 text-3xl">Welcome back</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to request and track your Bullet ride.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mt-8">
            <LoginForm />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            New here? <Link href="/register">Create a passenger account</Link>.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

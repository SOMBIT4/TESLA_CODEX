import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <section className="mx-auto flex max-w-3xl flex-col gap-8 rounded-2xl border bg-card p-8 shadow-sm sm:p-12">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Dhaka Tesla Pool
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Share a seat. Split the fare. Survive Dhaka traffic.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            A small, explainable ride-pooling MVP built around Jashim, Bullet,
            Nusrat, Rafiq, and Shirin.
          </p>
        </div>
        <Button className="w-fit">Bootstrap ready</Button>
      </section>
    </main>
  );
}

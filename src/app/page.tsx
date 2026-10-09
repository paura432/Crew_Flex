import { ButtonLink } from "@/components/ui/Button";

const FLOW = [
  "Organization requirement",
  "Internal workforce",
  "Capacity gap",
  "Eligible external network",
  "Coverage",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-navy text-[#c4d3e1]">
      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24">
        <header className="flex items-center gap-3 text-white">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-lg bg-accent font-black text-navy"
          >
            CF
          </span>
          <span className="text-xl font-bold tracking-tight">Crew Flex</span>
        </header>
        <section className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            Aircraft maintenance workforce
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Turn qualifications, availability and demand into mobilisable technical capacity.
          </h1>
          <p className="mt-5 text-lg">
            Define what you need — 2 × B1.1, A320 family, EWIS + HF + FTS, Madrid, night shift — and
            see immediately what your own workforce covers, what the gap is, and which professionals
            really qualify. Every result is explained.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register" variant="primary">
              Create account
            </ButtonLink>
            <ButtonLink
              href="/login"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              Sign in
            </ButtonLink>
          </div>
        </section>
        <ol className="grid gap-2 sm:grid-cols-5" aria-label="Capacity-first flow">
          {FLOW.map((step, i) => (
            <li key={step} className="rounded-lg border border-white/10 px-3 py-3 text-sm">
              <span className="block font-mono text-xs text-accent">0{i + 1}</span>
              <span className="text-white">{step}</span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}

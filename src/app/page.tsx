export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-12 sm:px-10 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-blue-900/80">MontSignal</p>
        <h1 className="text-4xl font-semibold tracking-tight text-black sm:text-5xl">
          Mont Blanc weather & avalanche dashboard
        </h1>
        <p className="max-w-2xl text-base leading-7 text-neutral-600">
          Next.js + TypeScript starter is in place. Tailwind CSS and ESLint are configured. We will
          layer in Supabase, shadcn/ui, data fetching, and translations next.
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black">Tech stack ready</h2>
          <ul className="space-y-1 text-sm text-neutral-700">
            <li>• Next.js App Router with TypeScript</li>
            <li>• Tailwind CSS (v4) baseline styling</li>
            <li>• ESLint + Prettier with @/* import alias</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black">Next steps</h2>
          <ul className="space-y-1 text-sm text-neutral-700">
            <li>• Wire Supabase clients & env scaffolding</li>
            <li>• Add shadcn/ui primitives</li>
            <li>• Build ingestion + dashboard routes</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-brand-black text-brand-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Image src="/brand/sling-aircraft-logo.svg" alt="Sling Aircraft" width={228} height={100} priority className="h-24 w-auto" />
          <h1 className="font-display text-xl font-bold uppercase tracking-[0.12em]">Builder Tracker</h1>
          <p className="eyebrow text-white/60">Sling Aircraft Switzerland</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 text-ink">{children}</div>
      </div>
      <div className="h-1 bg-brand-red" aria-hidden />
    </div>
  );
}

import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-brand-black text-brand-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Image src="/brand/sling-aircraft-switzerland.jpg" alt="Sling Aircraft Switzerland" width={160} height={160} priority className="size-40 rounded" />
          <h1 className="font-display text-xl font-bold uppercase tracking-[0.2em]">Builder Tracker</h1>
        </div>
        <div className="rounded-lg bg-bg p-6 text-ink shadow-xl">{children}</div>
      </div>
      <div className="h-1 bg-brand-red" aria-hidden />
    </div>
  );
}

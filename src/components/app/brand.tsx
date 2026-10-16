import Image from "next/image";
import Link from "next/link";
import { cx } from "@/lib/format";

/** Marke «Sling Aircraft Switzerland»: Logo auf schwarzem Grund plus App-Name in gesperrten Versalien. */
export function Brand({ href = "/", compact = false, className }: { href?: string; compact?: boolean; className?: string }) {
  return (
    <Link href={href} className={cx("flex items-center gap-3 text-brand-white no-underline", className)} aria-label="Sling Builder Tracker">
      <Image src="/brand/sling-aircraft-logo.svg" alt="Sling Aircraft" width={82} height={36} priority className="h-9 w-auto" />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[0.95rem] font-bold uppercase tracking-[0.12em]">Builder Tracker</span>
          <span className="mt-1 font-display text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-white/70">Sling Aircraft Switzerland</span>
        </span>
      ) : null}
    </Link>
  );
}

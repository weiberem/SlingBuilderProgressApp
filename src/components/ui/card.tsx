import type { ComponentProps } from "react";
import { cx } from "@/lib/format";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-lg border border-line bg-surface shadow-[var(--shadow-1)]", className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"header">) {
  return <header className={cx("flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-2", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("px-4 pb-4", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return <p className={cx("eyebrow", className)} {...props} />;
}

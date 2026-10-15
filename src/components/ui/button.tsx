import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded font-semibold transition-colors select-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-brand-red text-on-red hover:bg-brand-red-hover active:bg-brand-red-hover",
  secondary: "bg-surface-2 text-ink border border-line hover:border-line-strong active:bg-line",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  danger: "bg-transparent text-status-problem border border-status-problem hover:bg-status-problem-soft",
};
const sizes: Record<Size, string> = {
  sm: "min-h-10 px-3 text-sm",
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-6 text-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

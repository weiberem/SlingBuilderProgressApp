import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/dal";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  const { next } = await searchParams;
  if (user) redirect(next && next.startsWith("/") ? next : "/");
  return <LoginForm next={next} />;
}

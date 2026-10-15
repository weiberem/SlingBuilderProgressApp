import { requireUser } from "@/modules/auth/dal";
import { listProjectsForUser } from "@/modules/projects/service";
import { AppShell, type NavItem } from "@/components/app/app-shell";
import { SwRegister } from "@/components/app/sw-register";

/** Bereich ohne Projektkontext (Projektliste, Einstellungen, Stammdaten). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const projects = await listProjectsForUser(user.id);
  const nav: NavItem[] = [{ key: "projects", href: "/" }];
  if (projects.length === 1) {
    const p = projects[0];
    nav.unshift({ key: "build", href: `/p/${p.id}` }, { key: "tasks", href: `/p/${p.id}/tasks` }, { key: "parts", href: `/p/${p.id}/parts` });
  }
  return (
    <AppShell nav={nav} userName={user.name} isAdmin={user.isPlatformAdmin}>
      <SwRegister />
      {children}
    </AppShell>
  );
}

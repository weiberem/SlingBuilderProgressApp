import { requireUser } from "@/modules/auth/dal";
import { getProjectContext } from "@/modules/projects/context";
import { getProject } from "@/modules/projects/service";
import { AppShell, type NavItem } from "@/components/app/app-shell";

/** Projektbereich: prüft die Mitgliedschaft (404 bei fremden Projekten) und zeigt die Projektnavigation. */
export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireUser();
  const ctx = await getProjectContext(projectId);
  const project = await getProject(ctx);
  const base = `/p/${projectId}`;
  const nav: NavItem[] = [
    { key: "build", href: base },
    { key: "tasks", href: `${base}/tasks` },
    { key: "parts", href: `${base}/parts` },
    { key: "setup", href: `${base}/setup` },
  ];
  return (
    <AppShell nav={nav} registration={project.registration} userName={user.name} isAdmin={user.isPlatformAdmin}>
      {children}
    </AppShell>
  );
}

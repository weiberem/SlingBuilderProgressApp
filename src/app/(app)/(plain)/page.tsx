import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/modules/auth/dal";
import { listProjectsForUser } from "@/modules/projects/service";
import { Card, CardBody, Eyebrow } from "@/components/ui/card";

/** Startseite: genau ein Projekt → direkt hinein; sonst Liste. */
export default async function HomePage() {
  const user = await requireUser();
  const projects = await listProjectsForUser(user.id);
  if (projects.length === 1) redirect(`/p/${projects[0].id}`);
  const t = await getTranslations("common.nav");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl">{t("projects")}</h1>
      {projects.length === 0 ? <p className="text-ink-muted">Noch kein Projekt. Bitte `pnpm seed` ausführen.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={`/p/${p.id}`} className="block no-underline">
              <Card className="transition-colors hover:border-line-strong">
                <CardBody className="pt-4">
                  <Eyebrow>{p.modelName}</Eyebrow>
                  <p className="font-display text-2xl font-bold">{p.registration}</p>
                  <p className="text-sm text-ink-muted">{p.name}</p>
                </CardBody>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

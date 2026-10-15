import { getTranslations } from "next-intl/server";
import { requireUser } from "@/modules/auth/dal";
import { Card, CardBody, CardHeader, Eyebrow } from "@/components/ui/card";
import { InstallHint } from "@/components/app/install-hint";
import { ChangePasswordForm } from "./change-password-form";
import { ThemeSwitch } from "./theme-switch";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [t, tPwa] = await Promise.all([getTranslations("auth.settings"), getTranslations("pwa.install")]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl">{t("title")}</h1>
      <Card>
        <CardHeader>
          <Eyebrow>{t("account")}</Eyebrow>
        </CardHeader>
        <CardBody className="flex flex-col gap-1">
          <p>
            <span className="text-ink-muted">{t("name")}:</span> {user.name}
          </p>
          <p>
            <span className="text-ink-muted">{t("email")}:</span> {user.email}
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <Eyebrow>{t("changePassword")}</Eyebrow>
        </CardHeader>
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <Eyebrow>{t("theme")}</Eyebrow>
        </CardHeader>
        <CardBody>
          <ThemeSwitch />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <Eyebrow>{tPwa("title")}</Eyebrow>
        </CardHeader>
        <CardBody>
          <InstallHint />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <Eyebrow>{t("integrations")}</Eyebrow>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-ink-muted">{t("integrationsSoon")}</p>
        </CardBody>
      </Card>
    </div>
  );
}

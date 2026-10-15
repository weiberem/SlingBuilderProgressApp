import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthFailure, verifyEmail } from "@/modules/auth/service";
import { Notice } from "@/components/ui/field";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("auth.verify");
  let ok = false;
  try {
    await verifyEmail(token);
    ok = true;
  } catch (e) {
    if (!(e instanceof AuthFailure)) throw e;
  }
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl">{t("title")}</h2>
      {ok ? <Notice tone="success">{t("done")}</Notice> : <Notice tone="error">{t("invalid")}</Notice>}
      <Link href="/login" className="text-center text-sm underline underline-offset-2">
        Anmelden
      </Link>
    </div>
  );
}

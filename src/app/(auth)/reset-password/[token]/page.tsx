import { ResetForm } from "./reset-form";

export const metadata = { title: "Neues Passwort" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ResetForm token={token} />;
}

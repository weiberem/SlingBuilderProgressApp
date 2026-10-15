import { requireUser } from "@/modules/auth/dal";
import { SwRegister } from "@/components/app/sw-register";
import { OfflineSync } from "@/components/app/offline-sync";

/** Angemeldeter Bereich: Session-Pflicht, Service Worker und Offline-Sync. Die Kopfleiste setzen die Unter-Layouts. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <SwRegister />
      <OfflineSync />
      {children}
    </>
  );
}

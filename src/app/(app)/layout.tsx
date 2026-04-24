export const dynamic = "force-dynamic";

import { AppShell } from "./_app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

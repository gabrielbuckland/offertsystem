import '../globals.css';
import { AppShell } from '../../components/shell/AppShell.js';

// US-10: Tailwind bewusst auf diese Gruppe begrenzt — Offert-Routen ausserhalb von
// (anwendung) behalten ihr eigenstaendiges Druck-Stylesheet und duerfen Tailwinds
// Preflight-Reset nicht abbekommen.
export default function AnwendungsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

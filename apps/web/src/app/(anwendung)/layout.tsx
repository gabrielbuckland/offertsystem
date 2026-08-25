import '../globals.css';
import { AppShell } from '../../components/shell/AppShell.js';

// Tailwind bewusst auf diese Gruppe begrenzt: Die Offert-Routen ausserhalb von
// (anwendung) behalten ihr eigenstaendiges Druck-Stylesheet aus `packages/offer` und
// duerfen Tailwinds Preflight-Reset nicht abbekommen (US-10).
export default function AnwendungsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

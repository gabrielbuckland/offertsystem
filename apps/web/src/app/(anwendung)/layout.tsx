import '../globals.css';
import { AppShell } from '../../components/shell/AppShell.js';

// US-10: Tailwind bewusst auf diese Gruppe begrenzt, Offert-Druckrouten behalten ihr eigenes Stylesheet.
export default function AnwendungsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

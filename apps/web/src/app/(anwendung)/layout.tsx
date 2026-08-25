import '../globals.css';
import { AppShell } from '../../components/shell/AppShell.js';

export default function AnwendungsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

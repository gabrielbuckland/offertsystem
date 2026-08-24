import '../globals.css';

/**
 * Gruppen-Layout ohne eigenes `<html>`/`<body>` (das bleibt im Wurzellayout). Grenzt
 * Tailwind auf die Anwendungsrouten ein: die Offert-Routen ausserhalb dieser Gruppe
 * bleiben beim eigenstaendigen Druck-Stylesheet aus `packages/offer`, ohne Tailwinds
 * Preflight-Reset (US-10, Spec §7).
 */
export default function AnwendungsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

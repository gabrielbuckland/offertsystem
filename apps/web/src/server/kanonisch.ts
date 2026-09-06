// E-26/NFA-07/A-13/I-09: Pruefsumme der effektiven Konfiguration. NICHT die eingebettete
// Konfigurationskopie — der Name `konfigurationsAbdruck` ist dafuer reserviert (PE-04).
import { createHash } from 'node:crypto';

export function kanonischSerialisieren(wert: unknown): string {
  if (wert === null) return 'null';
  if (typeof wert !== 'object') return JSON.stringify(wert) ?? 'null';
  if (Array.isArray(wert)) {
    return `[${wert.map((element) => kanonischSerialisieren(element)).join(',')}]`;
  }
  const eintraege = Object.entries(wert as Record<string, unknown>)
    .filter(([, inhalt]) => inhalt !== undefined)
    .sort(([links], [rechts]) => (links < rechts ? -1 : links > rechts ? 1 : 0));
  const teile = eintraege.map(
    ([schluessel, inhalt]) => `${JSON.stringify(schluessel)}:${kanonischSerialisieren(inhalt)}`,
  );
  return `{${teile.join(',')}}`;
}

export function bildePruefsumme(wert: unknown): string {
  return createHash('sha256').update(kanonischSerialisieren(wert), 'utf8').digest('hex');
}

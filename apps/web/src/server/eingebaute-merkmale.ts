// Einheitsfelder als Staffelkriterium ohne eigene Erfassung. Bei id-Kollision gewinnt
// das Einheitsfeld. Client-safe wie `wirksamer-wert.ts`; strukturelle Typen, damit kein
// Laufzeit-Zyklus mit projekt-schema.ts entsteht.

export interface EingebautesMerkmal {
  readonly id: 'flaecheInnen' | 'flaecheAussen';
  readonly bezeichnung: string;
  readonly form: 'zahl';
}

export const EINGEBAUTE_MERKMALE: readonly EingebautesMerkmal[] = [
  { id: 'flaecheInnen', bezeichnung: 'Fläche (m²)', form: 'zahl' },
  { id: 'flaecheAussen', bezeichnung: 'Aussenfläche (m²)', form: 'zahl' },
];

const EINGEBAUTE_IDS = new Set<string>(EINGEBAUTE_MERKMALE.map((m) => m.id));

interface Merkmalstraeger {
  readonly flaecheInnen: number;
  readonly flaecheAussen: number;
  readonly merkmalswerte: Readonly<Record<string, number | undefined>>;
}

export function leseMerkmalswert(
  einheit: Merkmalstraeger,
  merkmalId: string,
): number | undefined {
  if (merkmalId === 'flaecheInnen') return einheit.flaecheInnen;
  if (merkmalId === 'flaecheAussen') return einheit.flaecheAussen;
  return einheit.merkmalswerte[merkmalId];
}

export function waehlbareMerkmale(
  merkmale: readonly { readonly id: string; readonly bezeichnung: string; readonly form: 'zahl' }[],
): readonly { readonly id: string; readonly bezeichnung: string; readonly form: 'zahl' }[] {
  return [...merkmale.filter((m) => !EINGEBAUTE_IDS.has(m.id)), ...EINGEBAUTE_MERKMALE];
}

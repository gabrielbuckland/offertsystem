'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Projekt } from '../../server/projekt-schema.js';

const ENTPRELLUNG_MS = 400;

/**
 * Haelt den Projektstand und speichert ihn entprellt.
 *
 * Entprellt, weil jede Zelleingabe einen Tastendruck ausloest; ungebremst entstuende je
 * Zeichen ein Schreibvorgang auf dieselbe Datei.
 */
export function verwendeProjekt(anfang: Projekt) {
  const [projekt, setzeProjekt] = useState(anfang);
  const [speichernLaeuft, setzeSpeichern] = useState(false);
  const zeitgeber = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const aendere = useCallback((naechster: Projekt) => {
    setzeProjekt(naechster);
    if (zeitgeber.current !== undefined) clearTimeout(zeitgeber.current);
    zeitgeber.current = setTimeout(() => {
      setzeSpeichern(true);
      void fetch(`/api/projekt/${naechster.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(naechster),
      }).finally(() => setzeSpeichern(false));
    }, ENTPRELLUNG_MS);
  }, []);

  useEffect(() => () => {
    if (zeitgeber.current !== undefined) clearTimeout(zeitgeber.current);
  }, []);

  return { projekt, aendere, speichernLaeuft };
}

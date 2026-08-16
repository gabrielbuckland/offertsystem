/**
 * Aufloesungshaken fuer die Werkzeuglaufzeit (PE-09).
 *
 * Der Kern importiert intern nach NodeNext-Konvention mit `.js`-Endung, obwohl
 * die Dateien `.ts` heissen. Node nimmt diese Abbildung beim Type-Stripping
 * nicht selbst vor. Dieser Haken bildet `<pfad>.js` auf `<pfad>.ts` ab, und
 * zwar NUR fuer Quellen unterhalb von packages/ und apps/ — Abhaengigkeiten aus
 * node_modules bleiben unberuehrt.
 *
 * Bewusst `.mjs`: Der Haken laedt, bevor das Type-Stripping aktiv ist, und darf
 * deshalb selbst kein TypeScript sein.
 */
import { register } from 'node:module';

register(new URL('ts-aufloeser-hook.mjs', import.meta.url));

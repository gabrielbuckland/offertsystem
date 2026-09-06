// Aufloesungshaken fuer die Werkzeuglaufzeit (PE-09): der Kern importiert intern nach
// NodeNext-Konvention mit .js-Endung, obwohl die Dateien .ts heissen, und Node bildet das
// beim Type-Stripping nicht selbst ab. Dieser Haken mappt <pfad>.js auf <pfad>.ts, nur
// unterhalb von packages/ und apps/ — node_modules bleibt unberuehrt.
// Bewusst .mjs: laedt, bevor das Type-Stripping aktiv ist, und darf daher kein TypeScript sein.
import { register } from 'node:module';

register(new URL('ts-aufloeser-hook.mjs', import.meta.url));

/**
 * Keine Formel. PDF-Export durch Druck DERSELBEN gerenderten Seite (Brief §5.7, I-25).
 *
 * Playwright druckt die Vorlage; es erzeugt das Dokument nicht neu. Damit ist die Zusage
 * «PDF und HTML zeigen dieselben Zahlen» konstruktiv gesichert statt nachtraeglich
 * geprueft — es gibt keinen zweiten Renderpfad, der abweichen koennte.
 *
 * Playwright dient hier ausschliesslich dem PDF-Export, nicht dem Oberflaechentest
 * (Kapitel 4.4).
 *
 * Die Browserfabrik ist injizierbar, damit der Druckablauf ohne echten Browser pruefbar
 * ist: Ein Test, der Chromium startet, prueft Playwright, nicht diesen Code.
 */
import { chromium } from 'playwright';

export interface DruckOptionen {
  readonly basisUrl: string;
  readonly offertId: string;
  readonly referenznummer?: string;
}

export type BrowserFabrik = () => Promise<{
  newPage(): Promise<{
    goto(url: string, o: { waitUntil: 'load' }): Promise<unknown>;
    waitForSelector(sel: string, o: { state: 'attached' }): Promise<unknown>;
    emulateMedia(o: { media: 'print' }): Promise<unknown>;
    pdf(o: Record<string, unknown>): Promise<Buffer>;
  }>;
  close(): Promise<void>;
}>;

const standardFabrik: BrowserFabrik = () => chromium.launch() as ReturnType<BrowserFabrik>;

export async function druckeOfferte(
  optionen: DruckOptionen,
  starte: BrowserFabrik = standardFabrik,
): Promise<Buffer> {
  const browser = await starte();
  try {
    const seite = await browser.newPage();
    await seite.goto(`${optionen.basisUrl}/offerte/${optionen.offertId}/druck`,
                     { waitUntil: 'load' });
    // Deterministisches Bereitschaftssignal statt Zeitlimit: Das Attribut steht im
    // serverseitig erzeugten Markup, ein Wartezeitraum waere eine Vermutung.
    await seite.waitForSelector('[data-druck-bereit="true"]', { state: 'attached' });
    await seite.emulateMedia({ media: 'print' });
    return await seite.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="font-size:8pt;width:100%;padding:0 15mm;display:flex;'
        + 'justify-content:space-between;">'
        + `<span>${optionen.referenznummer ?? optionen.offertId}</span>`
        + '<span class="pageNumber"></span>/<span class="totalPages"></span></div>',
    });
  } finally {
    // Auch im Fehlerfall: Ein offener Browserprozess ueberlebt sonst den Lauf.
    await browser.close();
  }
}

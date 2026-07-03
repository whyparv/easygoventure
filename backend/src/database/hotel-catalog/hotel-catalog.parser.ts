import { readDocxDocumentXml } from './docx-reader';
import { RawHotelRecord } from './hotel-catalog.types';

/**
 * HotelCatalogParser
 * ------------------
 * Stage 1 of the pipeline. Reads the raw asset and extracts one untrusted
 * {@link RawHotelRecord} per hotel row. It makes NO cleaning decisions — its only
 * job is to faithfully pull `rawName`, `rawArea`, and the star-rating section each
 * row belongs to, so later stages have a stable, traceable input.
 *
 * Source shape (observed): three tables (5-, 4- and 3-STAR), each preceded by a
 * heading paragraph like "⭐⭐⭐⭐⭐ 5-STAR HOTELS" and laid out as
 * `# | Hotel Name | Area`. The parser does not hardcode row counts or ordering;
 * it walks the document body in order and attributes each table row to the most
 * recent rating heading it saw.
 */
export class HotelCatalogParser {
  /** Detected section headings, in document order (for the data-quality report). */
  readonly sections: string[] = [];
  totalRowsScanned = 0;
  headerRowsSkipped = 0;

  /** Parse a .docx asset from disk into raw records. */
  parseFile(filePath: string): RawHotelRecord[] {
    return this.parseXml(readDocxDocumentXml(filePath));
  }

  /** Parse an already-extracted document.xml string (used by unit tests). */
  parseXml(xml: string): RawHotelRecord[] {
    const records: RawHotelRecord[] = [];
    let currentRating = '';

    // Walk table rows (<w:tr>) and paragraphs (<w:p>) in document order.
    const tokenRe = /<w:tr\b[\s\S]*?<\/w:tr>|<w:p\b[\s\S]*?<\/w:p>/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(xml)) !== null) {
      const chunk = match[0];

      if (chunk.startsWith('<w:tr')) {
        const cells = this.extractCells(chunk);
        this.totalRowsScanned += 1;

        // Skip the header row of each table ("# / Hotel Name / Area").
        const joined = cells.join(' ');
        if (/hotel\s*name/i.test(joined)) {
          this.headerRowsSkipped += 1;
          continue;
        }
        const { name, area } = this.pickNameAndArea(cells);
        if (!name) {
          this.headerRowsSkipped += 1;
          continue;
        }
        records.push({
          rawName: name,
          rawArea: area,
          rawRating: currentRating,
          sourceRow: records.length + 1,
        });
      } else {
        // Paragraph — may be a star-rating section heading.
        const text = this.cellText(chunk);
        if (text && this.looksLikeRatingHeading(text)) {
          currentRating = text;
          this.sections.push(text);
        }
      }
    }

    return records;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Split a table row into its cells' plain text. */
  private extractCells(rowXml: string): string[] {
    const cells: string[] = [];
    const cellRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
    let m: RegExpExecArray | null;
    while ((m = cellRe.exec(rowXml)) !== null) {
      cells.push(this.cellText(m[0]));
    }
    return cells;
  }

  /**
   * Concatenate the text runs (<w:t>) inside a chunk and decode XML entities.
   * The `(?:\s[^>]*)?` guard ensures we match <w:t> / <w:t xml:space="preserve">
   * but NOT sibling tags like <w:tcPr> or <w:tcW>.
   */
  private cellText(chunkXml: string): string {
    const runRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let out = '';
    let m: RegExpExecArray | null;
    while ((m = runRe.exec(chunkXml)) !== null) {
      out += m[1];
    }
    return this.decodeEntities(out).replace(/\s+/g, ' ').trim();
  }

  private decodeEntities(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
  }

  /** A row is `# | Name | Area`; tolerate a missing leading `#` column. */
  private pickNameAndArea(cells: string[]): { name: string; area: string } {
    const nonEmpty = cells.map((c) => c.trim());
    if (nonEmpty.length >= 3) {
      // Standard 3-column row; first cell is the ordinal number.
      return { name: nonEmpty[1], area: nonEmpty[2] };
    }
    if (nonEmpty.length === 2) {
      // Degraded row without an ordinal column.
      return { name: nonEmpty[0], area: nonEmpty[1] };
    }
    return { name: nonEmpty[0] ?? '', area: '' };
  }

  private looksLikeRatingHeading(text: string): boolean {
    return /(\b[345]\s*-?\s*star\b)|(⭐{3,5})/i.test(text);
  }
}

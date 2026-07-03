import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/**
 * Minimal, dependency-free reader for the one part of a .docx we need:
 * `word/document.xml`.
 *
 * A .docx is a ZIP archive. Rather than pull in a ZIP/office dependency just to
 * run an offline data-prep step, we parse the ZIP central directory directly and
 * inflate the single entry we care about. This keeps the seeding toolchain free
 * of native/runtime dependencies (the cleaned JSON it produces is what the app
 * actually consumes at runtime).
 *
 * The parser is intentionally strict and well-commented — it only supports the
 * two things Office ever emits: STORED (0) and DEFLATE (8).
 */

const EOCD_SIGNATURE = 0x06054b50; // End Of Central Directory
const CEN_SIGNATURE = 0x02014b50; // Central directory file header
const LOC_SIGNATURE = 0x04034b50; // Local file header

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

/** Locate the End Of Central Directory record (searching backwards past any comment). */
function findEocd(buf: Buffer): number {
  // EOCD is 22 bytes minimum; the trailing comment is almost always empty.
  const minOffset = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minOffset; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error('Not a valid .docx (ZIP EOCD record not found)');
}

/** Walk the central directory and return every entry's metadata. */
function readCentralDirectory(buf: Buffer): ZipEntry[] {
  const eocd = findEocd(buf);
  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (buf.readUInt32LE(offset) !== CEN_SIGNATURE) {
      throw new Error(`Corrupt ZIP central directory at entry ${i}`);
    }
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const uncompressedSize = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);

    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Inflate a single entry's bytes using its local header to locate the data. */
function extractEntry(buf: Buffer, entry: ZipEntry): Buffer {
  const lho = entry.localHeaderOffset;
  if (buf.readUInt32LE(lho) !== LOC_SIGNATURE) {
    throw new Error(`Corrupt ZIP local header for "${entry.name}"`);
  }
  const nameLen = buf.readUInt16LE(lho + 26);
  const extraLen = buf.readUInt16LE(lho + 28);
  const dataStart = lho + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return Buffer.from(data); // STORED
  if (entry.method === 8) return inflateRawSync(data); // DEFLATE
  throw new Error(`Unsupported ZIP compression method ${entry.method} for "${entry.name}"`);
}

/**
 * Read a .docx file from disk and return the raw XML of its main document part.
 * Throws a descriptive error if the file is not a valid Office Open XML document.
 */
export function readDocxDocumentXml(filePath: string): string {
  const buf = readFileSync(filePath);
  const entries = readCentralDirectory(buf);
  const doc = entries.find((e) => e.name === 'word/document.xml');
  if (!doc) {
    throw new Error(`"${filePath}" is not a Word document (word/document.xml missing)`);
  }
  return extractEntry(buf, doc).toString('utf8');
}

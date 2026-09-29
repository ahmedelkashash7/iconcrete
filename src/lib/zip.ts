/**
 * Minimal ZIP writer (store method, no compression).
 *
 * The pack is text, so compression would buy little, and shipping 60+ files as
 * one download is worth more than a few kilobytes. Store-only keeps the writer
 * auditable: a fixed local header, the raw bytes, a central directory and the
 * end-of-central-directory record — nothing else.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipEntry = {
  /** Path inside the archive, with forward slashes. */
  path: string;
  content: string;
};

function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private length = 0;

  push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  u16(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): void {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  get size(): number {
    return this.length;
  }

  merge(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

export const ZIP_MIME = "application/zip";

export function createZip(entries: ZipEntry[], modified = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(modified);
  const out = new ByteWriter();
  const directory: Array<{ name: Uint8Array; crc: number; size: number; offset: number }> = [];

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    const offset = out.size;

    out.u32(0x04034b50); // local file header
    out.u16(20); // version needed
    out.u16(0x0800); // UTF-8 file names
    out.u16(0); // store
    out.u16(time);
    out.u16(date);
    out.u32(crc);
    out.u32(data.length);
    out.u32(data.length);
    out.u16(name.length);
    out.u16(0);
    out.push(name);
    out.push(data);

    directory.push({ name, crc, size: data.length, offset });
  }

  const directoryOffset = out.size;
  for (const item of directory) {
    out.u32(0x02014b50); // central directory header
    out.u16(20); // version made by
    out.u16(20); // version needed
    out.u16(0x0800);
    out.u16(0);
    out.u16(time);
    out.u16(date);
    out.u32(item.crc);
    out.u32(item.size);
    out.u32(item.size);
    out.u16(item.name.length);
    out.u16(0); // extra
    out.u16(0); // comment
    out.u16(0); // disk number
    out.u16(0); // internal attributes
    out.u32(0); // external attributes
    out.u32(item.offset);
    out.push(item.name);
  }

  const directorySize = out.size - directoryOffset;

  out.u32(0x06054b50); // end of central directory
  out.u16(0);
  out.u16(0);
  out.u16(directory.length);
  out.u16(directory.length);
  out.u32(directorySize);
  out.u32(directoryOffset);
  out.u16(0);

  return out.merge();
}

/** Browser download helper; a no-op outside the browser. */
export function downloadZip(filename: string, entries: ZipEntry[]): number {
  const bytes = createZip(entries);
  if (typeof document === "undefined") return bytes.length;
  const blob = new Blob([bytes as unknown as BlobPart], { type: ZIP_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return bytes.length;
}

/** Single-file download for the copy/download buttons inside the pack screen. */
export function downloadText(filename: string, content: string, mime = "text/plain"): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

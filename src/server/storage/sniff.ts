import type { UploadType } from "@/lib/uploads/policy";

/** Bytes needed to recognise every allowed type. */
export const SNIFF_BYTES = 64;

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

/**
 * Checks the file's first bytes match its declared type, so a renamed executable or HTML file
 * can't be stored as a "photo". DXF is text, so it is checked for a text DXF header.
 */
export function matchesType(bytes: Uint8Array, type: UploadType): boolean {
  switch (type) {
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
    case "image/heic":
      // ISO-BMFF "ftyp" box with a HEIF brand
      return (
        ascii(bytes, 4, 8) === "ftyp" &&
        /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(ascii(bytes, 8, 12))
      );
    case "application/pdf":
      return ascii(bytes, 0, 5) === "%PDF-";
    case "image/vnd.dwg":
      return /^AC10\d\d$/.test(ascii(bytes, 0, 6));
    case "image/vnd.dxf": {
      const head = ascii(bytes, 0, Math.min(bytes.length, SNIFF_BYTES)).replace(/^﻿/, "");
      return /^\s*0\s*\r?\n\s*SECTION/.test(head) || /^\s*999\s*\r?\n/.test(head);
    }
  }
}

// ─── File Upload Security: Magic Bytes + Content Scanning ───
//
// Every uploaded file is validated BEFORE being written to disk:
//   1. Magic bytes check — verify actual file type matches claimed MIME
//   2. Content scan — detect malicious payloads (JS in PDFs, scripts in SVGs, etc.)
//   3. Size enforcement — per-type limits
//   4. Filename sanitization
//
// Usage:
//   const result = await scanUploadedFile(file, "document");
//   if (!result.safe) return NextResponse.json({ error: result.reason }, { status: 400 });
//   // result.buffer, result.sanitizedName, result.detectedType are safe to use

// ─── Magic Bytes Signatures ───

interface MagicSignature {
  mime: string;
  ext: string[];
  bytes: number[];
  offset?: number;
}

const SIGNATURES: MagicSignature[] = [
  // Images
  { mime: "image/jpeg", ext: ["jpg", "jpeg"], bytes: [0xFF, 0xD8, 0xFF] },
  { mime: "image/png", ext: ["png"], bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: "image/gif", ext: ["gif"], bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: "image/webp", ext: ["webp"], bytes: [0x52, 0x49, 0x46, 0x46], }, // RIFF...WEBP (check WEBP at offset 8)
  { mime: "image/bmp", ext: ["bmp"], bytes: [0x42, 0x4D] },
  { mime: "image/tiff", ext: ["tiff", "tif"], bytes: [0x49, 0x49, 0x2A, 0x00] }, // Little-endian
  { mime: "image/tiff", ext: ["tiff", "tif"], bytes: [0x4D, 0x4D, 0x00, 0x2A] }, // Big-endian

  // PDF
  { mime: "application/pdf", ext: ["pdf"], bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF

  // Office OOXML (ZIP-based)
  { mime: "application/zip", ext: ["zip", "docx", "xlsx", "pptx"], bytes: [0x50, 0x4B, 0x03, 0x04] },

  // Legacy Office (OLE2)
  { mime: "application/msword", ext: ["doc", "xls", "ppt"], bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] },

  // Audio
  { mime: "audio/mpeg", ext: ["mp3"], bytes: [0x49, 0x44, 0x33] }, // ID3 tag
  { mime: "audio/mpeg", ext: ["mp3"], bytes: [0xFF, 0xFB] }, // MPEG sync
  { mime: "audio/mpeg", ext: ["mp3"], bytes: [0xFF, 0xF3] },
  { mime: "audio/mpeg", ext: ["mp3"], bytes: [0xFF, 0xF2] },
  { mime: "audio/ogg", ext: ["ogg", "oga"], bytes: [0x4F, 0x67, 0x67, 0x53] }, // OggS
  { mime: "audio/wav", ext: ["wav"], bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF...WAVE
  { mime: "audio/flac", ext: ["flac"], bytes: [0x66, 0x4C, 0x61, 0x43] }, // fLaC
  { mime: "audio/aac", ext: ["aac"], bytes: [0xFF, 0xF1] }, // ADTS
  { mime: "audio/aac", ext: ["aac"], bytes: [0xFF, 0xF9] },

  // Videos
  { mime: "video/mp4", ext: ["mp4", "m4v"], bytes: [0x00, 0x00, 0x00], }, // ftyp at offset 4
  { mime: "video/webm", ext: ["webm"], bytes: [0x1A, 0x45, 0xDF, 0xA3] }, // EBML
  { mime: "video/x-msvideo", ext: ["avi"], bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF...AVI
  { mime: "video/quicktime", ext: ["mov"], bytes: [0x00, 0x00, 0x00] }, // ftyp at offset 4

  // Text/CSV (no strong magic bytes — validated by content)
  { mime: "text/plain", ext: ["txt", "csv"], bytes: [] },
];

// ─── File Type Categories ───

export type FileCategory = "document" | "image" | "video" | "verification" | "message";

interface CategoryConfig {
  allowedMimes: string[];
  maxSize: number;
  label: string;
}

const CATEGORY_CONFIG: Record<FileCategory, CategoryConfig> = {
  document: {
    allowedMimes: [
      "application/pdf",
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv", "text/plain",
      "application/zip",
    ],
    maxSize: 10 * 1024 * 1024, // 10 MB
    label: "document",
  },
  image: {
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxSize: 5 * 1024 * 1024, // 5 MB
    label: "image",
  },
  video: {
    allowedMimes: [
      "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo",
      "video/x-matroska", "video/mpeg",
    ],
    maxSize: 200 * 1024 * 1024, // 200 MB
    label: "vidéo",
  },
  verification: {
    allowedMimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    maxSize: 10 * 1024 * 1024, // 10 MB
    label: "document de vérification",
  },
  message: {
    allowedMimes: [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv", "text/plain",
      "application/zip",
      "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/mp4",
      "audio/flac", "audio/aac", "audio/x-m4a",
      "video/webm",
    ],
    maxSize: 20 * 1024 * 1024, // 20 MB
    label: "pièce jointe",
  },
};

// ─── Scan Result ───

export type ScanResult =
  | { safe: true; buffer: Buffer; sanitizedName: string; detectedType: string; detectedMime: string }
  | { safe: false; reason: string };

// ─── Public API ───

/**
 * Scan an uploaded file for safety before writing to disk.
 *
 * @param file - The uploaded File object from formData
 * @param category - File category determining allowed types and size limits
 * @returns ScanResult with buffer and metadata if safe, or rejection reason
 */
export async function scanUploadedFile(file: File, category: FileCategory): Promise<ScanResult> {
  const config = CATEGORY_CONFIG[category];

  // 1. Size check
  if (file.size > config.maxSize) {
    const maxMB = Math.round(config.maxSize / (1024 * 1024));
    return { safe: false, reason: `Fichier trop volumineux (max ${maxMB} Mo pour ${config.label}).` };
  }

  if (file.size === 0) {
    return { safe: false, reason: "Le fichier est vide." };
  }

  // 2. Read buffer
  const buffer = Buffer.from(await file.arrayBuffer());

  // 3. Magic bytes detection
  const detected = detectFileType(buffer, file.name);
  if (!detected) {
    return { safe: false, reason: "Type de fichier non reconnu. Vérifiez le format." };
  }

  // 4. Verify detected type is in allowed list
  // Map detected MIME to allowed list (handle OOXML variants)
  const effectiveMime = resolveOoxmlMime(detected.mime, file.name, file.type);
  if (!config.allowedMimes.includes(effectiveMime) && !config.allowedMimes.includes(detected.mime)) {
    return { safe: false, reason: `Format ${detected.ext} non autorisé pour ${config.label}.` };
  }

  // 5. Content scanning based on detected type
  const contentScan = scanContent(buffer, detected.mime, file.name);
  if (!contentScan.safe) {
    return contentScan;
  }

  // 6. Sanitize filename
  const sanitizedName = sanitizeFilename(file.name);

  return {
    safe: true,
    buffer,
    sanitizedName,
    detectedType: detected.ext,
    detectedMime: effectiveMime,
  };
}

// ─── Magic Bytes Detection ───

function detectFileType(buffer: Buffer, filename: string): { mime: string; ext: string } | null {
  if (buffer.length < 4) return null;

  // Special case: MP4/MOV — check for "ftyp" at offset 4
  if (buffer.length >= 8) {
    const ftyp = buffer.toString("ascii", 4, 8);
    if (ftyp === "ftyp") {
      const brand = buffer.toString("ascii", 8, 12);
      if (["M4A ", "M4B "].includes(brand)) {
        return { mime: "audio/mp4", ext: "m4a" };
      }
      if (["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "dash"].includes(brand)) {
        return { mime: "video/mp4", ext: "mp4" };
      }
      if (["qt  ", "moov"].includes(brand) || brand.startsWith("qt")) {
        return { mime: "video/quicktime", ext: "mov" };
      }
      // Generic ftyp — likely MP4 variant
      return { mime: "video/mp4", ext: "mp4" };
    }
  }

  // Special case: WEBP — RIFF + WEBP at offset 8
  if (buffer.length >= 12) {
    const riff = buffer.toString("ascii", 0, 4);
    const webp = buffer.toString("ascii", 8, 12);
    if (riff === "RIFF" && webp === "WEBP") {
      return { mime: "image/webp", ext: "webp" };
    }
    // AVI — RIFF + AVI at offset 8
    if (riff === "RIFF" && buffer.toString("ascii", 8, 11) === "AVI") {
      return { mime: "video/x-msvideo", ext: "avi" };
    }
    // WAV — RIFF + WAVE at offset 8
    if (riff === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE") {
      return { mime: "audio/wav", ext: "wav" };
    }
  }

  // Special case: EBML — could be video/webm or audio/webm
  if (buffer.length >= 4 && buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "weba" || ext === "opus") return { mime: "audio/webm", ext: "webm" };
    // Check claimed MIME from filename hint
    return { mime: "video/webm", ext: "webm" };
  }

  // Check signatures
  for (const sig of SIGNATURES) {
    if (sig.bytes.length === 0) continue; // Skip text (no magic)
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) continue;

    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return { mime: sig.mime, ext: sig.ext[0] };
    }
  }

  // Fallback: text/CSV detection (UTF-8 printable chars)
  if (isTextFile(buffer)) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "csv") return { mime: "text/csv", ext: "csv" };
    if (ext === "txt") return { mime: "text/plain", ext: "txt" };
    return { mime: "text/plain", ext: "txt" };
  }

  return null;
}

function isTextFile(buffer: Buffer): boolean {
  // Check first 8KB for non-text bytes
  const checkLen = Math.min(buffer.length, 8192);
  let nonText = 0;
  for (let i = 0; i < checkLen; i++) {
    const b = buffer[i];
    // Allow: printable ASCII, tab, newline, carriage return, UTF-8 continuation
    if (b === 0) return false; // Null byte → not text
    if (b < 0x20 && b !== 0x09 && b !== 0x0A && b !== 0x0D) nonText++;
  }
  // Allow up to 1% non-text bytes (for BOM, etc.)
  return nonText / checkLen < 0.01;
}

// ─── OOXML MIME Resolution ───
// ZIP magic bytes → determine actual Office type from extension/claimed MIME

function resolveOoxmlMime(detectedMime: string, filename: string, claimedMime: string): string {
  if (detectedMime !== "application/zip") return detectedMime;

  const ext = filename.split(".").pop()?.toLowerCase();

  // Map OOXML extensions to proper MIME types
  const ooxmlMap: Record<string, string> = {
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  if (ext && ooxmlMap[ext]) return ooxmlMap[ext];

  // Trust claimed MIME if it's a known OOXML type
  const knownOoxml = Object.values(ooxmlMap);
  if (knownOoxml.includes(claimedMime)) return claimedMime;

  return "application/zip";
}

// ─── Content Scanning ───

function scanContent(buffer: Buffer, mime: string, filename: string): { safe: true } | { safe: false; reason: string } {
  if (mime === "application/pdf") {
    return scanPdf(buffer);
  }

  if (mime === "image/svg+xml" || filename.toLowerCase().endsWith(".svg")) {
    return scanSvg(buffer);
  }

  if (mime.startsWith("image/")) {
    return scanImage(buffer, mime);
  }

  if (mime === "application/zip" || mime.startsWith("application/vnd.openxmlformats")) {
    return scanZipArchive(buffer);
  }

  if (mime === "text/plain" || mime === "text/csv") {
    return scanText(buffer);
  }

  return { safe: true };
}

// ─── PDF Scanning ───

function scanPdf(buffer: Buffer): { safe: true } | { safe: false; reason: string } {
  const content = buffer.toString("latin1");

  // Detect JavaScript in PDFs
  const jsPatterns = [
    /\/JavaScript\s/i,
    /\/JS\s*\(/i,
    /\/JS\s*</i,
    /\/OpenAction\s.*\/JavaScript/i,
    /\/AA\s.*\/JavaScript/i,       // Additional Actions with JS
    /\/Launch\s/i,                  // Launch external application
    /\/SubmitForm\s/i,             // Submit form data
    /\/ImportData\s/i,             // Import data
    /\/RichMedia\s/i,              // Embedded rich media
    /\/EmbeddedFile\s/i,           // Embedded files
  ];

  for (const pattern of jsPatterns) {
    if (pattern.test(content)) {
      return { safe: false, reason: "PDF rejeté : contenu actif détecté (JavaScript, actions ou fichiers embarqués)." };
    }
  }

  // Detect encrypted/obfuscated streams that could hide malware
  const suspiciousPatterns = [
    /\/Encrypt\s/i,                // Encrypted PDF (can't scan content)
    /\/AcroForm\s.*\/XFA/i,       // XFA forms (complex attack surface)
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      return { safe: false, reason: "PDF rejeté : formulaires XFA ou chiffrement détecté." };
    }
  }

  return { safe: true };
}

// ─── SVG Scanning ───

function scanSvg(buffer: Buffer): { safe: true } | { safe: false; reason: string } {
  const content = buffer.toString("utf8").toLowerCase();

  const dangerousPatterns = [
    /<script[\s>]/i,
    /javascript:/i,
    /on\w+\s*=/i,                  // Event handlers: onclick=, onload=, etc.
    /<foreignobject[\s>]/i,        // Can embed HTML
    /<iframe[\s>]/i,
    /<embed[\s>]/i,
    /<object[\s>]/i,
    /data:text\/html/i,
    /data:application\/x-javascript/i,
    /xlink:href\s*=\s*["']javascript/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return { safe: false, reason: "SVG rejeté : contenu actif détecté (scripts, événements ou objets embarqués)." };
    }
  }

  return { safe: true };
}

// ─── Image Scanning ───

function scanImage(buffer: Buffer, mime: string): { safe: true } | { safe: false; reason: string } {
  // Verify image has valid header structure
  if (mime === "image/jpeg") {
    // JPEG must start with FF D8 FF and contain at least one segment
    if (buffer.length < 20 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
      return { safe: false, reason: "Image JPEG invalide : en-tête corrompu." };
    }
  }

  if (mime === "image/png") {
    // PNG must have valid 8-byte header
    const pngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if (buffer.length < 16) {
      return { safe: false, reason: "Image PNG invalide : fichier trop petit." };
    }
    for (let i = 0; i < pngHeader.length; i++) {
      if (buffer[i] !== pngHeader[i]) {
        return { safe: false, reason: "Image PNG invalide : en-tête corrompu." };
      }
    }
  }

  // Check for polyglot files: image header but contains embedded scripts
  const textContent = buffer.toString("latin1", 0, Math.min(buffer.length, 4096));
  if (/<script[\s>]/i.test(textContent) || /javascript:/i.test(textContent)) {
    return { safe: false, reason: "Image rejetée : contenu suspect détecté." };
  }

  return { safe: true };
}

// ─── ZIP/OOXML Scanning ───

function scanZipArchive(buffer: Buffer): { safe: true } | { safe: false; reason: string } {
  // Check for ZIP bombs: file claims to be tiny but decompresses to gigabytes
  // Simple heuristic: if file is very small (<1KB) but has ZIP structure, flag it
  // More robust: check local file headers for excessive uncompressed sizes

  if (buffer.length < 30) {
    return { safe: false, reason: "Archive invalide : fichier trop petit." };
  }

  // Parse local file headers to check compression ratios
  let offset = 0;
  let totalUncompressed = 0;
  let fileCount = 0;
  const maxFiles = 1000;
  const maxUncompressedTotal = 500 * 1024 * 1024; // 500MB total uncompressed

  while (offset + 30 <= buffer.length && fileCount < maxFiles) {
    // Local file header signature: PK\x03\x04
    if (buffer[offset] !== 0x50 || buffer[offset + 1] !== 0x4B ||
        buffer[offset + 2] !== 0x03 || buffer[offset + 3] !== 0x04) {
      break;
    }

    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);

    totalUncompressed += uncompressedSize;
    fileCount++;

    // Check individual file compression ratio (>100:1 is suspicious)
    if (compressedSize > 0 && uncompressedSize / compressedSize > 100) {
      return { safe: false, reason: "Archive rejetée : ratio de compression suspect (zip bomb potentiel)." };
    }

    // Check total uncompressed size
    if (totalUncompressed > maxUncompressedTotal) {
      return { safe: false, reason: "Archive rejetée : taille décompressée excessive." };
    }

    offset += 30 + nameLen + extraLen + compressedSize;
  }

  if (fileCount >= maxFiles) {
    return { safe: false, reason: "Archive rejetée : trop de fichiers." };
  }

  // For OOXML: check for VBA macros (vbaProject.bin)
  const contentStr = buffer.toString("latin1");
  if (/vbaProject\.bin/i.test(contentStr)) {
    return { safe: false, reason: "Document Office rejeté : macros VBA détectées." };
  }

  return { safe: true };
}

// ─── Text File Scanning ───

function scanText(buffer: Buffer): { safe: true } | { safe: false; reason: string } {
  const content = buffer.toString("utf8", 0, Math.min(buffer.length, 16384));

  // Check for HTML/script injection in CSV/text
  if (/<script[\s>]/i.test(content) || /javascript:/i.test(content)) {
    return { safe: false, reason: "Fichier texte rejeté : contenu HTML/script détecté." };
  }

  // Check for formula injection (CSV injection)
  // Dangerous: cells starting with =, +, -, @, \t, \r that could execute formulas
  const lines = content.split("\n");
  for (const line of lines.slice(0, 100)) {
    const firstCell = line.split(",")[0]?.trim();
    if (firstCell && /^[=+\-@]/.test(firstCell) && /[A-Z]\(/.test(firstCell)) {
      return { safe: false, reason: "CSV rejeté : formules potentiellement dangereuses détectées." };
    }
  }

  return { safe: true };
}

// ─── Filename Sanitization ───

export function sanitizeFilename(name: string): string {
  // Remove path separators and null bytes
  let clean = name.replace(/[\/\\:\0]/g, "_");

  // Remove leading dots (hidden files)
  clean = clean.replace(/^\.+/, "");

  // Keep only safe characters
  clean = clean.replace(/[^a-zA-Z0-9._\-() àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]/g, "_");

  // Collapse multiple underscores
  clean = clean.replace(/_+/g, "_");

  // Limit length
  if (clean.length > 200) {
    const ext = clean.split(".").pop() || "";
    clean = clean.slice(0, 190) + "." + ext;
  }

  return clean || "file";
}

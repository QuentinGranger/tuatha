// ─── Encrypted Backup System ───
//
// Automated encrypted backups for database (PostgreSQL) and uploaded files.
//
// Features:
//   1. pg_dump for full database backup
//   2. tar.gz of /uploads directory for file backup
//   3. AES-256-GCM encryption of all backup artifacts
//   4. SHA-256 integrity verification
//   5. Retention policy (configurable max backups)
//   6. Restore from encrypted backup
//   7. Structured logging for audit trail
//
// Usage:
//   import { backup } from "@/lib/backup";
//   const result = await backup.createFull("manual");
//   const verified = await backup.verify(result.id);
//   await backup.restore(result.id, { database: true, files: false });
//   backup.getHistory();

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import {
  writeFile,
  readFile,
  mkdir,
  readdir,
  stat,
  unlink,
  access,
} from "fs/promises";
import path from "path";
import { secrets } from "@/lib/vault";

const exec = promisify(execCb);

// ─── Configuration ───

const CONFIG = {
  // Backup storage directory (outside of public web root)
  backupDir: path.resolve(process.cwd(), ".backups"),

  // Uploads directory to back up
  uploadsDir: path.resolve(process.cwd(), "uploads"),

  // Encryption
  algorithm: "aes-256-gcm" as const,
  ivLength: 16,
  authTagLength: 16,

  // Retention
  maxBackups: 30,          // Keep last 30 backups
  maxAgeDays: 90,          // Delete backups older than 90 days

  // Database
  databaseUrl: () => secrets.databaseUrl(),
};

// ─── Types ───

export type BackupType = "full" | "database" | "files";
export type BackupTrigger = "manual" | "scheduled" | "pre_migration" | "pre_rotation";

export interface BackupManifest {
  id: string;
  timestamp: string;
  type: BackupType;
  trigger: BackupTrigger;
  version: number;             // Schema version for forward compat
  artifacts: BackupArtifact[];
  encrypted: true;
  checksums: Record<string, string>;  // filename → SHA-256 of encrypted file
  metadata: {
    databaseUrl: string;       // Sanitized (no password)
    nodeEnv: string;
    appVersion: string;
    totalSizeBytes: number;
  };
}

interface BackupArtifact {
  name: string;
  type: "database" | "files";
  encryptedFile: string;       // Filename of encrypted artifact
  originalSizeBytes: number;
  encryptedSizeBytes: number;
}

export interface BackupResult {
  id: string;
  success: boolean;
  manifest: BackupManifest | null;
  duration: number;            // ms
  error?: string;
}

interface BackupHistoryEntry {
  id: string;
  timestamp: string;
  type: BackupType;
  trigger: BackupTrigger;
  totalSize: number;
  artifacts: number;
  verified: boolean;
}

// ─── History store (in-memory, populated from disk on first call) ───

const history: BackupHistoryEntry[] = [];
let historyLoaded = false;

// ─── Encryption helpers ───

function getBackupKey(): Buffer {
  const key = secrets.encryptionKey();
  if (!key || key.length !== 64) {
    throw new Error("[Backup] ENCRYPTION_KEY invalide ou manquante.");
  }
  // Derive a separate key for backups using HKDF-like derivation
  const derived = createHash("sha256")
    .update(Buffer.from(key, "hex"))
    .update("tuatha-backup-v1")
    .digest();
  return derived;
}

function encryptBuffer(plaintext: Buffer): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
  const key = getBackupKey();
  const iv = randomBytes(CONFIG.ivLength);
  const cipher = createCipheriv(CONFIG.algorithm, key, iv, {
    authTagLength: CONFIG.authTagLength,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { encrypted, iv, authTag };
}

function decryptBuffer(encrypted: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const key = getBackupKey();
  const decipher = createDecipheriv(CONFIG.algorithm, key, iv, {
    authTagLength: CONFIG.authTagLength,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/** Write encrypted file: [16 bytes IV][16 bytes authTag][...ciphertext] */
async function writeEncrypted(filePath: string, data: Buffer): Promise<{ size: number }> {
  const { encrypted, iv, authTag } = encryptBuffer(data);
  const output = Buffer.concat([iv, authTag, encrypted]);
  await writeFile(filePath, output);
  return { size: output.length };
}

/** Read and decrypt file: [16 bytes IV][16 bytes authTag][...ciphertext] */
async function readEncrypted(filePath: string): Promise<Buffer> {
  const raw = await readFile(filePath);
  const iv = raw.subarray(0, CONFIG.ivLength);
  const authTag = raw.subarray(CONFIG.ivLength, CONFIG.ivLength + CONFIG.authTagLength);
  const encrypted = raw.subarray(CONFIG.ivLength + CONFIG.authTagLength);
  return decryptBuffer(encrypted, iv, authTag);
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function sanitizeDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    u.password = "***";
    return u.toString();
  } catch {
    return "***";
  }
}

function generateBackupId(): string {
  const now = new Date();
  const date = now.toISOString().replace(/[:.T]/g, "-").slice(0, 19);
  const rand = randomBytes(4).toString("hex");
  return `backup-${date}-${rand}`;
}

// ─── Ensure backup directory ───

async function ensureBackupDir(subDir?: string): Promise<string> {
  const dir = subDir ? path.join(CONFIG.backupDir, subDir) : CONFIG.backupDir;
  await mkdir(dir, { recursive: true });
  return dir;
}

// ─── Database backup (pg_dump) ───

async function backupDatabase(backupDir: string): Promise<BackupArtifact> {
  const dumpFile = path.join(backupDir, "database.sql");
  const dbUrl = CONFIG.databaseUrl();

  // pg_dump with custom format for compression
  await exec(`pg_dump "${dbUrl}" --no-owner --no-acl -F plain -f "${dumpFile}"`, {
    timeout: 5 * 60 * 1000, // 5 min timeout
    env: { ...process.env, PGPASSWORD: undefined }, // URL includes auth
  });

  const dumpData = await readFile(dumpFile);
  const originalSize = dumpData.length;

  // Encrypt the dump
  const encryptedFile = "database.sql.enc";
  const { size: encryptedSize } = await writeEncrypted(
    path.join(backupDir, encryptedFile),
    dumpData,
  );

  // Remove plaintext dump
  await unlink(dumpFile);

  return {
    name: "PostgreSQL database",
    type: "database",
    encryptedFile,
    originalSizeBytes: originalSize,
    encryptedSizeBytes: encryptedSize,
  };
}

// ─── Files backup (tar of uploads/) ───

async function backupFiles(backupDir: string): Promise<BackupArtifact> {
  const tarFile = path.join(backupDir, "uploads.tar.gz");
  const uploadsDir = CONFIG.uploadsDir;

  // Check if uploads dir exists
  try {
    await access(uploadsDir);
  } catch {
    // No uploads dir — create empty artifact
    return {
      name: "Uploaded files",
      type: "files",
      encryptedFile: "uploads.tar.gz.enc",
      originalSizeBytes: 0,
      encryptedSizeBytes: 0,
    };
  }

  // Create tar.gz of uploads directory
  await exec(`tar -czf "${tarFile}" -C "${path.dirname(uploadsDir)}" "${path.basename(uploadsDir)}"`, {
    timeout: 10 * 60 * 1000, // 10 min timeout
  });

  const tarData = await readFile(tarFile);
  const originalSize = tarData.length;

  // Encrypt the tar
  const encryptedFile = "uploads.tar.gz.enc";
  const { size: encryptedSize } = await writeEncrypted(
    path.join(backupDir, encryptedFile),
    tarData,
  );

  // Remove plaintext tar
  await unlink(tarFile);

  return {
    name: "Uploaded files",
    type: "files",
    encryptedFile,
    originalSizeBytes: originalSize,
    encryptedSizeBytes: encryptedSize,
  };
}

// ─── Retention policy ───

async function applyRetention(): Promise<number> {
  let removed = 0;

  try {
    const entries = await readdir(CONFIG.backupDir, { withFileTypes: true });
    const backupDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("backup-"))
      .map((e) => e.name)
      .sort(); // Oldest first

    // Remove by age
    const maxAgeMs = CONFIG.maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAgeMs;

    for (const dir of backupDirs) {
      try {
        const manifestPath = path.join(CONFIG.backupDir, dir, "manifest.json");
        const manifestData = await readFile(manifestPath, "utf8");
        const manifest: BackupManifest = JSON.parse(manifestData);
        const backupTime = new Date(manifest.timestamp).getTime();

        if (backupTime < cutoff) {
          await exec(`rm -rf "${path.join(CONFIG.backupDir, dir)}"`);
          removed++;
        }
      } catch {
        // Skip corrupt entries
      }
    }

    // Remove by count (keep newest maxBackups)
    const remaining = (await readdir(CONFIG.backupDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && e.name.startsWith("backup-"))
      .map((e) => e.name)
      .sort()
      .reverse(); // Newest first

    if (remaining.length > CONFIG.maxBackups) {
      for (const dir of remaining.slice(CONFIG.maxBackups)) {
        await exec(`rm -rf "${path.join(CONFIG.backupDir, dir)}"`);
        removed++;
      }
    }
  } catch {
    // Backup dir doesn't exist yet
  }

  if (removed > 0) {
    console.log(`[Backup] Retention: ${removed} old backup(s) removed.`);
  }

  return removed;
}

// ─── Load history from disk ───

async function loadHistory(): Promise<void> {
  if (historyLoaded) return;
  historyLoaded = true;

  try {
    const entries = await readdir(CONFIG.backupDir, { withFileTypes: true });
    const backupDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("backup-"))
      .map((e) => e.name)
      .sort()
      .reverse();

    for (const dir of backupDirs.slice(0, 50)) {
      try {
        const manifestPath = path.join(CONFIG.backupDir, dir, "manifest.json");
        const manifestData = await readFile(manifestPath, "utf8");
        const manifest: BackupManifest = JSON.parse(manifestData);

        history.push({
          id: manifest.id,
          timestamp: manifest.timestamp,
          type: manifest.type,
          trigger: manifest.trigger,
          totalSize: manifest.metadata.totalSizeBytes,
          artifacts: manifest.artifacts.length,
          verified: false,
        });
      } catch {
        // Skip corrupt
      }
    }
  } catch {
    // No backups yet
  }
}

// ─── Public API ───

export const backup = {

  /**
   * Create an encrypted backup.
   *
   * @param trigger - What triggered this backup
   * @param type    - What to back up (default: "full" = database + files)
   */
  async createFull(
    trigger: BackupTrigger = "manual",
    type: BackupType = "full",
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const id = generateBackupId();

    console.log(`[Backup] Starting ${type} backup (${trigger}): ${id}`);

    try {
      const backupDir = await ensureBackupDir(id);
      const artifacts: BackupArtifact[] = [];
      const checksums: Record<string, string> = {};

      // Database backup
      if (type === "full" || type === "database") {
        const dbArtifact = await backupDatabase(backupDir);
        artifacts.push(dbArtifact);

        // Compute checksum of encrypted file
        const encData = await readFile(path.join(backupDir, dbArtifact.encryptedFile));
        checksums[dbArtifact.encryptedFile] = sha256(encData);
      }

      // Files backup
      if (type === "full" || type === "files") {
        const filesArtifact = await backupFiles(backupDir);
        if (filesArtifact.encryptedSizeBytes > 0) {
          artifacts.push(filesArtifact);

          const encData = await readFile(path.join(backupDir, filesArtifact.encryptedFile));
          checksums[filesArtifact.encryptedFile] = sha256(encData);
        }
      }

      const totalSize = artifacts.reduce((sum, a) => sum + a.encryptedSizeBytes, 0);

      // Write manifest (unencrypted — contains no sensitive data)
      const manifest: BackupManifest = {
        id,
        timestamp: new Date().toISOString(),
        type,
        trigger,
        version: 1,
        artifacts,
        encrypted: true,
        checksums,
        metadata: {
          databaseUrl: sanitizeDatabaseUrl(CONFIG.databaseUrl()),
          nodeEnv: process.env.NODE_ENV || "development",
          appVersion: "1.0.0",
          totalSizeBytes: totalSize,
        },
      };

      await writeFile(
        path.join(backupDir, "manifest.json"),
        JSON.stringify(manifest, null, 2),
      );

      const duration = Date.now() - startTime;

      // Apply retention policy
      await applyRetention();

      // Add to history
      history.unshift({
        id,
        timestamp: manifest.timestamp,
        type,
        trigger,
        totalSize,
        artifacts: artifacts.length,
        verified: false,
      });

      const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
      console.log(
        `[Backup] ✅ ${type} backup completed: ${id} (${sizeMB} MB, ${duration}ms, ${artifacts.length} artifact(s))`,
      );

      return { id, success: true, manifest, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Backup] ❌ Backup failed: ${message}`);

      return { id, success: false, manifest: null, duration, error: message };
    }
  },

  /**
   * Verify backup integrity (checksums + decryption test).
   */
  async verify(backupId: string): Promise<{
    valid: boolean;
    checks: { name: string; passed: boolean; detail?: string }[];
  }> {
    const checks: { name: string; passed: boolean; detail?: string }[] = [];

    try {
      const backupDir = path.join(CONFIG.backupDir, backupId);
      const manifestData = await readFile(path.join(backupDir, "manifest.json"), "utf8");
      const manifest: BackupManifest = JSON.parse(manifestData);

      checks.push({ name: "Manifest lisible", passed: true });

      // Check each artifact
      for (const artifact of manifest.artifacts) {
        const filePath = path.join(backupDir, artifact.encryptedFile);

        // File exists
        try {
          await access(filePath);
          checks.push({ name: `${artifact.name}: fichier présent`, passed: true });
        } catch {
          checks.push({
            name: `${artifact.name}: fichier présent`,
            passed: false,
            detail: "Fichier manquant",
          });
          continue;
        }

        // Checksum
        const encData = await readFile(filePath);
        const actualChecksum = sha256(encData);
        const expectedChecksum = manifest.checksums[artifact.encryptedFile];

        if (actualChecksum === expectedChecksum) {
          checks.push({ name: `${artifact.name}: checksum SHA-256`, passed: true });
        } else {
          checks.push({
            name: `${artifact.name}: checksum SHA-256`,
            passed: false,
            detail: `Attendu: ${expectedChecksum?.slice(0, 16)}..., Réel: ${actualChecksum.slice(0, 16)}...`,
          });
          continue;
        }

        // Decryption test (decrypt first 1KB to verify key + integrity)
        try {
          await readEncrypted(filePath);
          checks.push({ name: `${artifact.name}: déchiffrement`, passed: true });
        } catch (err) {
          checks.push({
            name: `${artifact.name}: déchiffrement`,
            passed: false,
            detail: err instanceof Error ? err.message : "Échec de déchiffrement",
          });
        }
      }

      // Update history
      const entry = history.find((h) => h.id === backupId);
      if (entry) entry.verified = checks.every((c) => c.passed);

      return {
        valid: checks.every((c) => c.passed),
        checks,
      };
    } catch (error) {
      checks.push({
        name: "Lecture du backup",
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      });
      return { valid: false, checks };
    }
  },

  /**
   * Restore from an encrypted backup.
   * ⚠️ DESTRUCTIVE — overwrites current data.
   *
   * @param backupId - The backup ID to restore from
   * @param opts     - What to restore (database, files, or both)
   */
  async restore(
    backupId: string,
    opts: { database?: boolean; files?: boolean } = { database: true, files: true },
  ): Promise<{ success: boolean; restored: string[]; errors: string[] }> {
    const restored: string[] = [];
    const errors: string[] = [];

    console.warn(`[Backup] ⚠️ Starting RESTORE from ${backupId}`);

    try {
      const backupDir = path.join(CONFIG.backupDir, backupId);
      const manifestData = await readFile(path.join(backupDir, "manifest.json"), "utf8");
      const manifest: BackupManifest = JSON.parse(manifestData);

      // Verify before restoring
      const verification = await this.verify(backupId);
      if (!verification.valid) {
        return {
          success: false,
          restored: [],
          errors: ["Vérification d'intégrité échouée. Restauration annulée."],
        };
      }

      // Restore database
      if (opts.database) {
        const dbArtifact = manifest.artifacts.find((a) => a.type === "database");
        if (dbArtifact) {
          try {
            const encPath = path.join(backupDir, dbArtifact.encryptedFile);
            const sqlData = await readEncrypted(encPath);

            // Write decrypted SQL to temp file
            const tmpSql = path.join(backupDir, "restore.sql");
            await writeFile(tmpSql, sqlData);

            const dbUrl = CONFIG.databaseUrl();
            await exec(`psql "${dbUrl}" -f "${tmpSql}"`, {
              timeout: 10 * 60 * 1000,
            });

            await unlink(tmpSql);
            restored.push("database");
            console.log("[Backup] ✅ Database restored.");
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Database: ${msg}`);
            console.error(`[Backup] ❌ Database restore failed: ${msg}`);
          }
        }
      }

      // Restore files
      if (opts.files) {
        const filesArtifact = manifest.artifacts.find((a) => a.type === "files");
        if (filesArtifact && filesArtifact.encryptedSizeBytes > 0) {
          try {
            const encPath = path.join(backupDir, filesArtifact.encryptedFile);
            const tarData = await readEncrypted(encPath);

            // Write decrypted tar to temp file
            const tmpTar = path.join(backupDir, "restore.tar.gz");
            await writeFile(tmpTar, tarData);

            // Extract to project root (uploads/ directory)
            await exec(`tar -xzf "${tmpTar}" -C "${process.cwd()}"`, {
              timeout: 10 * 60 * 1000,
            });

            await unlink(tmpTar);
            restored.push("files");
            console.log("[Backup] ✅ Files restored.");
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Files: ${msg}`);
            console.error(`[Backup] ❌ Files restore failed: ${msg}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        restored,
        errors,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, restored, errors: [msg] };
    }
  },

  /**
   * List all available backups.
   */
  async getHistory(): Promise<BackupHistoryEntry[]> {
    await loadHistory();
    return [...history];
  },

  /**
   * Get a specific backup's manifest.
   */
  async getManifest(backupId: string): Promise<BackupManifest | null> {
    try {
      const manifestPath = path.join(CONFIG.backupDir, backupId, "manifest.json");
      const data = await readFile(manifestPath, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  /**
   * Delete a specific backup.
   */
  async delete(backupId: string): Promise<boolean> {
    try {
      const backupDir = path.join(CONFIG.backupDir, backupId);
      await exec(`rm -rf "${backupDir}"`);
      const idx = history.findIndex((h) => h.id === backupId);
      if (idx >= 0) history.splice(idx, 1);
      console.log(`[Backup] Backup ${backupId} deleted.`);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get backup configuration summary (for monitoring).
   */
  getConfig(): {
    backupDir: string;
    uploadsDir: string;
    maxBackups: number;
    maxAgeDays: number;
    encryptionAlgorithm: string;
    encryptionKeyConfigured: boolean;
  } {
    let keyConfigured = false;
    try {
      getBackupKey();
      keyConfigured = true;
    } catch {
      // Key not available
    }

    return {
      backupDir: CONFIG.backupDir,
      uploadsDir: CONFIG.uploadsDir,
      maxBackups: CONFIG.maxBackups,
      maxAgeDays: CONFIG.maxAgeDays,
      encryptionAlgorithm: CONFIG.algorithm,
      encryptionKeyConfigured: keyConfigured,
    };
  },
};

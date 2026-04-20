#!/usr/bin/env npx tsx
// ─── Backup & Restore Test Suite ───
//
// Tests the full backup lifecycle:
//   1. Encryption round-trip (encrypt → decrypt, integrity)
//   2. Tamper detection (modified ciphertext fails GCM auth)
//   3. Full backup creation (database + files)
//   4. Backup verification (checksums + decryption)
//   5. Manifest integrity
//   6. Restore dry-run validation
//   7. Cleanup
//
// Usage:
//   npx tsx scripts/test-backup-restore.ts
//
// Requires:
//   - ENCRYPTION_KEY in .env
//   - DATABASE_URL in .env (PostgreSQL running)
//   - pg_dump and psql available in PATH

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { writeFile, readFile, mkdir, readdir, unlink, rm, access } from "fs/promises";
import path from "path";
import { exec as execCb } from "child_process";
import { promisify } from "util";

const exec = promisify(execCb);

// ─── Load .env manually (no dotenv dependency) ───
import { readFileSync } from "fs";
try {
  const envPath = path.resolve(process.cwd(), ".env");
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env file not found — rely on existing env vars */ }

// ─── Test state ───

let passed = 0;
let failed = 0;
let skipped = 0;
const errors: string[] = [];

function assert(condition: boolean, name: string, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    const msg = detail ? `${name} — ${detail}` : name;
    errors.push(msg);
    console.log(`  ❌ ${name}${detail ? ` (${detail})` : ""}`);
  }
}

function skip(name: string, reason: string): void {
  skipped++;
  console.log(`  ⏭️  ${name} — ${reason}`);
}

// ─── Encryption constants (must match backup.ts) ───

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getTestKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey || envKey.length !== 64) {
    throw new Error("ENCRYPTION_KEY missing or invalid in .env (need 64 hex chars)");
  }
  return createHash("sha256")
    .update(Buffer.from(envKey, "hex"))
    .update("tuatha-backup-v1")
    .digest();
}

function encryptBuffer(plaintext: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptBuffer(raw: Buffer, key: Buffer): Buffer {
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// ─── Test helpers ───

const TEST_DIR = path.resolve(process.cwd(), ".backups", "_test_restore");

async function cleanup(): Promise<void> {
  try {
    await rm(TEST_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════

async function main() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   Backup & Restore — Test Suite        ║");
  console.log("╚════════════════════════════════════════╝\n");

  const startTime = Date.now();

  // ── Pre-checks ──

  console.log("── Pré-requis ──");

  const encKey = process.env.ENCRYPTION_KEY;
  assert(!!encKey && encKey.length === 64, "ENCRYPTION_KEY configurée (64 hex chars)");
  if (!encKey || encKey.length !== 64) {
    console.error("\n⛔ ENCRYPTION_KEY invalide. Impossible de continuer.\n");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  assert(!!dbUrl, "DATABASE_URL configurée");

  let hasPgDump = false;
  try {
    await exec("which pg_dump");
    hasPgDump = true;
    assert(true, "pg_dump disponible dans PATH");
  } catch {
    skip("pg_dump disponible", "Non trouvé dans PATH");
  }

  let hasTar = false;
  try {
    await exec("which tar");
    hasTar = true;
    assert(true, "tar disponible dans PATH");
  } catch {
    skip("tar disponible", "Non trouvé dans PATH");
  }

  await cleanup();
  await mkdir(TEST_DIR, { recursive: true });

  // ═══════════════════════════════════════════
  // 1. Encryption Round-Trip
  // ═══════════════════════════════════════════

  console.log("\n── 1. Chiffrement AES-256-GCM ──");

  const key = getTestKey();

  // Small data
  {
    const original = Buffer.from("Hello Tuatha backup test! Données médicales sensibles 🏥");
    const encrypted = encryptBuffer(original, key);
    assert(encrypted.length > original.length, "Données chiffrées plus grandes que le plaintext");
    assert(!encrypted.includes(original), "Plaintext absent du ciphertext");

    const decrypted = decryptBuffer(encrypted, key);
    assert(Buffer.compare(original, decrypted) === 0, "Round-trip petit buffer (texte)");
  }

  // Large data (1 MB)
  {
    const original = randomBytes(1024 * 1024); // 1 MB
    const encrypted = encryptBuffer(original, key);
    const decrypted = decryptBuffer(encrypted, key);
    assert(Buffer.compare(original, decrypted) === 0, "Round-trip gros buffer (1 MB)");
  }

  // Empty data
  {
    const original = Buffer.alloc(0);
    const encrypted = encryptBuffer(original, key);
    const decrypted = decryptBuffer(encrypted, key);
    assert(Buffer.compare(original, decrypted) === 0, "Round-trip buffer vide");
  }

  // Binary data
  {
    const original = Buffer.from([0x00, 0xff, 0x01, 0xfe, 0x80, 0x7f]);
    const encrypted = encryptBuffer(original, key);
    const decrypted = decryptBuffer(encrypted, key);
    assert(Buffer.compare(original, decrypted) === 0, "Round-trip données binaires");
  }

  // ═══════════════════════════════════════════
  // 2. Tamper Detection (GCM auth tag)
  // ═══════════════════════════════════════════

  console.log("\n── 2. Détection de corruption (GCM) ──");

  {
    const original = Buffer.from("Sensitive medical data — do not tamper");
    const encrypted = encryptBuffer(original, key);

    // Tamper with ciphertext (flip a byte in the encrypted part)
    const tampered = Buffer.from(encrypted);
    const dataOffset = IV_LENGTH + AUTH_TAG_LENGTH + 5;
    if (dataOffset < tampered.length) {
      tampered[dataOffset] ^= 0xff;
    }

    let tamperedDetected = false;
    try {
      decryptBuffer(tampered, key);
    } catch {
      tamperedDetected = true;
    }
    assert(tamperedDetected, "Corruption du ciphertext détectée (auth tag fail)");
  }

  {
    const original = Buffer.from("Another test for IV tampering");
    const encrypted = encryptBuffer(original, key);

    // Tamper with IV
    const tampered = Buffer.from(encrypted);
    tampered[0] ^= 0xff;

    let ivTamperDetected = false;
    try {
      decryptBuffer(tampered, key);
    } catch {
      ivTamperDetected = true;
    }
    assert(ivTamperDetected, "Corruption de l'IV détectée");
  }

  {
    const original = Buffer.from("Auth tag tamper test");
    const encrypted = encryptBuffer(original, key);

    // Tamper with auth tag
    const tampered = Buffer.from(encrypted);
    tampered[IV_LENGTH + 2] ^= 0xff;

    let authTagTamperDetected = false;
    try {
      decryptBuffer(tampered, key);
    } catch {
      authTagTamperDetected = true;
    }
    assert(authTagTamperDetected, "Corruption de l'auth tag détectée");
  }

  // Wrong key
  {
    const original = Buffer.from("Wrong key test");
    const encrypted = encryptBuffer(original, key);

    const wrongKey = randomBytes(32);
    let wrongKeyDetected = false;
    try {
      decryptBuffer(encrypted, wrongKey);
    } catch {
      wrongKeyDetected = true;
    }
    assert(wrongKeyDetected, "Mauvaise clé de déchiffrement détectée");
  }

  // ═══════════════════════════════════════════
  // 3. File-Level Encrypt/Decrypt
  // ═══════════════════════════════════════════

  console.log("\n── 3. Fichiers chiffrés sur disque ──");

  {
    const testFile = path.join(TEST_DIR, "test_encrypt.bin");
    const original = Buffer.from("Contenu sensible sauvegardé sur disque — données patient #12345");

    // Write encrypted
    const { encrypted, iv, authTag } = (() => {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      const encrypted = Buffer.concat([cipher.update(original), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return { encrypted, iv, authTag };
    })();

    const output = Buffer.concat([iv, authTag, encrypted]);
    await writeFile(testFile, output);

    // Read and verify size
    const raw = await readFile(testFile);
    assert(raw.length === output.length, `Fichier chiffré écrit (${raw.length} bytes)`);

    // Decrypt from file
    const decrypted = decryptBuffer(raw, key);
    assert(
      decrypted.toString("utf8") === original.toString("utf8"),
      "Déchiffrement depuis fichier OK",
    );

    // Verify no plaintext leak on disk
    const rawStr = raw.toString("utf8");
    assert(
      !rawStr.includes("Contenu sensible"),
      "Pas de plaintext dans le fichier chiffré sur disque",
    );

    await unlink(testFile);
    assert(true, "Fichier temporaire nettoyé");
  }

  // ═══════════════════════════════════════════
  // 4. SHA-256 Checksum Integrity
  // ═══════════════════════════════════════════

  console.log("\n── 4. Checksums SHA-256 ──");

  {
    const data = Buffer.from("Checksum test data — backup artifact");
    const hash1 = createHash("sha256").update(data).digest("hex");
    const hash2 = createHash("sha256").update(data).digest("hex");
    assert(hash1 === hash2, "Checksum déterministe (même entrée = même hash)");

    const modified = Buffer.from(data);
    modified[0] ^= 0x01;
    const hash3 = createHash("sha256").update(modified).digest("hex");
    assert(hash1 !== hash3, "Modification détectée par checksum");
  }

  // ═══════════════════════════════════════════
  // 5. Full Backup → Verify → Manifest
  // ═══════════════════════════════════════════

  console.log("\n── 5. Backup complet (DB + fichiers) ──");

  let backupId: string | null = null;

  if (!hasPgDump || !dbUrl) {
    skip("Backup DB complet", "pg_dump ou DATABASE_URL indisponible");
  } else {
    try {
      // Dynamic import to use project's backup module
      const { backup } = await import("../src/lib/backup");

      // Create backup
      const result = await backup.createFull("manual", "full");
      assert(result.success, `Backup créé: ${result.id} (${result.duration}ms)`);
      backupId = result.id;

      if (result.manifest) {
        const m = result.manifest;
        assert(m.encrypted === true, "Manifest: encrypted=true");
        assert(m.version === 1, "Manifest: version=1");
        assert(m.type === "full", "Manifest: type=full");
        assert(m.trigger === "manual", "Manifest: trigger=manual");
        assert(m.artifacts.length >= 1, `Manifest: ${m.artifacts.length} artifact(s)`);
        assert(
          Object.keys(m.checksums).length === m.artifacts.length,
          `Manifest: ${Object.keys(m.checksums).length} checksum(s)`,
        );
        assert(
          !m.metadata.databaseUrl.includes("password") && m.metadata.databaseUrl.length > 0,
          "Manifest: DB URL sanitisée (pas de mot de passe en clair)",
        );
        assert(m.metadata.totalSizeBytes > 0, `Manifest: taille ${(m.metadata.totalSizeBytes / 1024).toFixed(1)} KB`);

        // Check DB artifact
        const dbArtifact = m.artifacts.find((a) => a.type === "database");
        if (dbArtifact) {
          assert(dbArtifact.originalSizeBytes > 0, `DB artifact: ${(dbArtifact.originalSizeBytes / 1024).toFixed(1)} KB original`);
          assert(dbArtifact.encryptedSizeBytes > 0, `DB artifact: ${(dbArtifact.encryptedSizeBytes / 1024).toFixed(1)} KB chiffré`);
          assert(
            dbArtifact.encryptedSizeBytes >= dbArtifact.originalSizeBytes,
            "DB artifact: taille chiffrée ≥ originale (IV+tag overhead)",
          );
        }
      }

      // Verify backup
      console.log("\n── 6. Vérification du backup ──");

      if (backupId) {
        const verification = await backup.verify(backupId);
        assert(verification.valid, "Vérification globale: VALIDE");

        for (const check of verification.checks) {
          assert(check.passed, `Vérif: ${check.name}`);
        }
      }

      // Get manifest from disk
      console.log("\n── 7. Lecture manifest depuis disque ──");

      if (backupId) {
        const manifest = await backup.getManifest(backupId);
        assert(manifest !== null, "Manifest lisible depuis disque");
        assert(manifest?.id === backupId, "Manifest ID correspond");
      }

      // History
      console.log("\n── 8. Historique ──");

      const history = await backup.getHistory();
      assert(history.length > 0, `Historique: ${history.length} backup(s)`);
      if (backupId) {
        const found = history.find((h) => h.id === backupId);
        assert(!!found, "Backup trouvé dans l'historique");
      }

      // Config
      const cfg = backup.getConfig();
      assert(cfg.encryptionKeyConfigured, "Config: clé de chiffrement OK");
      assert(cfg.maxBackups === 30, `Config: rétention ${cfg.maxBackups} backups`);

      // ═══════════════════════════════════════════
      // 9. Tamper Detection on Real Backup
      // ═══════════════════════════════════════════

      console.log("\n── 9. Détection de corruption sur backup réel ──");

      if (backupId && result.manifest) {
        const dbArtifact = result.manifest.artifacts.find((a) => a.type === "database");
        if (dbArtifact) {
          const encPath = path.join(cfg.backupDir, backupId, dbArtifact.encryptedFile);
          const original = await readFile(encPath);

          // Tamper with the encrypted file
          const tampered = Buffer.from(original);
          const midpoint = Math.floor(tampered.length / 2);
          tampered[midpoint] ^= 0xff;
          await writeFile(encPath, tampered);

          // Verification should now fail
          const tamperedVerification = await backup.verify(backupId);
          assert(
            !tamperedVerification.valid,
            "Backup corrompu détecté après modification",
          );

          // Restore original
          await writeFile(encPath, original);

          // Verify again — should pass
          const restoredVerification = await backup.verify(backupId);
          assert(restoredVerification.valid, "Backup restauré valide après correction");
        }
      }

      // ═══════════════════════════════════════════
      // 10. Restore Validation (dry-run: verify before restore)
      // ═══════════════════════════════════════════

      console.log("\n── 10. Validation de restauration ──");

      if (backupId) {
        // The restore function verifies integrity before restoring
        // We test with files: false, database: false (no-op but validates)
        const restoreResult = await backup.restore(backupId, {
          database: false,
          files: false,
        });
        assert(restoreResult.success, "Restore dry-run (rien à restaurer): succès");
        assert(restoreResult.errors.length === 0, "Restore dry-run: 0 erreurs");
      }

      // ═══════════════════════════════════════════
      // 11. Cleanup test backup
      // ═══════════════════════════════════════════

      console.log("\n── 11. Nettoyage ──");

      if (backupId) {
        const deleted = await backup.delete(backupId);
        assert(deleted, `Backup test ${backupId} supprimé`);

        const afterDelete = await backup.getManifest(backupId);
        assert(afterDelete === null, "Backup plus lisible après suppression");
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      assert(false, `Backup complet`, msg);
    }
  }

  // ═══════════════════════════════════════════
  // 12. Key Derivation Isolation
  // ═══════════════════════════════════════════

  console.log("\n── 12. Isolation des clés ──");

  {
    const rawKey = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");

    // Backup key derivation
    const backupKey = createHash("sha256")
      .update(rawKey)
      .update("tuatha-backup-v1")
      .digest();

    // Field encryption uses the raw key directly
    assert(
      !rawKey.equals(backupKey),
      "Clé backup ≠ clé chiffrement des champs (dérivation séparée)",
    );

    // Different salt produces different key
    const otherKey = createHash("sha256")
      .update(rawKey)
      .update("tuatha-other-v1")
      .digest();
    assert(
      !backupKey.equals(otherKey),
      "Salts différents → clés différentes",
    );
  }

  // ═══════════════════════════════════════════
  // Cleanup & Results
  // ═══════════════════════════════════════════

  await cleanup();

  const duration = Date.now() - startTime;

  console.log("\n╔════════════════════════════════════════╗");
  console.log("║   Résultats                            ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`  ✅ Passés:   ${passed}`);
  console.log(`  ❌ Échoués:  ${failed}`);
  console.log(`  ⏭️  Ignorés:  ${skipped}`);
  console.log(`  ⏱️  Durée:    ${duration}ms`);

  if (errors.length > 0) {
    console.log("\n  Erreurs:");
    for (const e of errors) {
      console.log(`    • ${e}`);
    }
  }

  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});

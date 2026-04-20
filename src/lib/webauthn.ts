import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import { secrets } from "@/lib/vault";

const RP_NAME = "Tuatha";
const RP_ID = secrets.webauthnRpId();
const ORIGIN = secrets.appUrl();

// Temporary challenge store (in-memory, keyed by proId)
const challengeStore = new Map<string, string>();

// ─── Registration ───

export async function generatePasskeyRegistration(proId: string, email: string) {
  const existingPasskeys = await prisma.passkey.findMany({
    where: { professionnelId: proId },
    select: { credentialId: true, transports: true },
  });

  const excludeCredentials = existingPasskeys.map((pk: { credentialId: string; transports: string[] }) => ({
    id: pk.credentialId,
    transports: pk.transports as AuthenticatorTransportFuture[],
  }));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: email,
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  challengeStore.set(proId, options.challenge);

  // Auto-cleanup after 5min
  setTimeout(() => challengeStore.delete(proId), 5 * 60 * 1000);

  return options;
}

export async function verifyPasskeyRegistration(
  proId: string,
  response: RegistrationResponseJSON,
  name?: string
) {
  const expectedChallenge = challengeStore.get(proId);
  if (!expectedChallenge) throw new Error("Challenge expiré ou introuvable.");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Vérification de la passkey échouée.");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await prisma.passkey.create({
    data: {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports || [],
      name: name || "Passkey",
      professionnelId: proId,
    },
  });

  challengeStore.delete(proId);

  return { verified: true };
}

// ─── Authentication ───

export async function generatePasskeyAuthentication(email?: string) {
  let allowCredentials: { id: string; transports: AuthenticatorTransportFuture[] }[] | undefined;

  if (email) {
    const pro = await prisma.professionnel.findUnique({ where: { email } });
    if (pro) {
      const passkeys = await prisma.passkey.findMany({
        where: { professionnelId: pro.id },
        select: { credentialId: true, transports: true },
      });
      allowCredentials = passkeys.map((pk: { credentialId: string; transports: string[] }) => ({
        id: pk.credentialId,
        transports: pk.transports as AuthenticatorTransportFuture[],
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: "preferred",
  });

  // Store challenge with a generic key (will be matched by credential lookup)
  const challengeKey = email ? `auth:${email}` : `auth:discoverable:${options.challenge.slice(0, 8)}`;
  challengeStore.set(challengeKey, options.challenge);
  setTimeout(() => challengeStore.delete(challengeKey), 5 * 60 * 1000);

  return { options, challengeKey };
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  challengeKey: string
) {
  const expectedChallenge = challengeStore.get(challengeKey);
  if (!expectedChallenge) throw new Error("Challenge expiré ou introuvable.");

  // Find the passkey by credential ID
  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
    include: { professionnel: { select: { id: true, email: true, prenom: true, specialite: true } } },
  });

  if (!passkey) throw new Error("Passkey inconnue.");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, "base64"),
      counter: passkey.counter,
      transports: passkey.transports as AuthenticatorTransportFuture[],
    },
  });

  if (!verification.verified) throw new Error("Authentification par passkey échouée.");

  // Update counter and lastUsedAt
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  challengeStore.delete(challengeKey);

  return {
    verified: true,
    professionnel: passkey.professionnel,
  };
}

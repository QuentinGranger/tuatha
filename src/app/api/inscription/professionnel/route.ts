import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { isDisposableEmail, validatePassword, generateVerifyCode } from "@/lib/security";
import { sendVerificationEmail } from "@/lib/email";
import { getRemboursementDefaults } from "@/lib/remboursement";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const nom = formData.get("nom") as string;
    const prenom = formData.get("prenom") as string;
    const email = formData.get("email") as string;
    const emailConfirm = formData.get("emailConfirm") as string;
    const telephone = formData.get("telephone") as string;
    const specialite = formData.get("specialite") as string;
    const statutExercice = formData.get("statutExercice") as string;
    const numeroVerification = formData.get("numeroVerification") as string;
    const password = formData.get("password") as string;
    const passwordConfirm = formData.get("passwordConfirm") as string;
    const avatar = formData.get("avatar") as File | null;
    const document = formData.get("document") as File | null;
    const cguVersion = formData.get("cguVersion") as string | null;
    const cguProVersion = formData.get("cguProVersion") as string | null;

    // Validation
    if (!nom || !prenom || !email || !telephone || !specialite || !statutExercice || !numeroVerification || !password) {
      return NextResponse.json(
        { error: "Tous les champs obligatoires doivent être remplis." },
        { status: 400 }
      );
    }

    if (email !== emailConfirm) {
      return NextResponse.json(
        { error: "Les emails ne correspondent pas." },
        { status: 400 }
      );
    }

    // Anti-temp-mail
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "Les adresses email temporaires ou jetables ne sont pas acceptées. Veuillez utiliser une adresse email professionnelle." },
        { status: 400 }
      );
    }

    // Strong password policy
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      const missing = pwdCheck.checks.filter((c) => !c.met).map((c) => c.label).join(", ");
      return NextResponse.json(
        { error: `Mot de passe trop faible. Manque : ${missing}` },
        { status: 400 }
      );
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { error: "Les mots de passe ne correspondent pas." },
        { status: 400 }
      );
    }

    // CGU acceptance required
    if (!cguVersion || !cguProVersion) {
      return NextResponse.json(
        { error: "L'acceptation des CGU et des CGU Professionnel est obligatoire." },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.professionnel.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Un compte avec cet email existe déjà." },
        { status: 409 }
      );
    }

    // Save uploaded files
    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });

    let avatarPath: string | null = null;
    if (avatar && avatar.size > 0) {
      const ext = path.extname(avatar.name);
      const filename = `avatar-${randomUUID()}${ext}`;
      const buffer = Buffer.from(await avatar.arrayBuffer());
      await writeFile(path.join(uploadsDir, filename), buffer);
      avatarPath = `/uploads/${filename}`;
    }

    let documentPath: string | null = null;
    if (document && document.size > 0) {
      const ext = path.extname(document.name);
      const filename = `doc-${randomUUID()}${ext}`;
      const buffer = Buffer.from(await document.arrayBuffer());
      await writeFile(path.join(uploadsDir, filename), buffer);
      documentPath = `/uploads/${filename}`;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification code
    const verifyCode = generateVerifyCode();
    const verifyExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Create professional
    const professionnel = await prisma.professionnel.create({
      data: {
        nom,
        prenom,
        email,
        telephone,
        specialite,
        statutExercice,
        numeroVerification,
        documentPath,
        avatarPath,
        password: hashedPassword,
        accountStatus: "draft",
        ...getRemboursementDefaults(specialite),
        verificationStatus: documentPath ? "pending" : "unverified",
        emailVerified: false,
        emailVerifyToken: verifyCode,
        emailVerifyExpires: verifyExpires,
        acceptedCguVersion: cguVersion,
        acceptedCguAt: new Date(),
        acceptedCguIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        acceptedCguProVersion: cguProVersion,
        acceptedCguProAt: new Date(),
        acceptedCguProIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });

    // Send verification email (non-blocking)
    sendVerificationEmail({ to: email, prenom, code: verifyCode }).catch((err) => {
      console.error("[Inscription] Failed to send verification email:", err);
    });

    return NextResponse.json(
      {
        message: "Inscription réussie ! Un code de vérification a été envoyé à votre adresse email.",
        id: professionnel.id,
        requiresEmailVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur inscription:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'inscription." },
      { status: 500 }
    );
  }
}

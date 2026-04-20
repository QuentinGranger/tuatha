import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { isDisposableEmail, validatePassword, generateVerifyCode } from "@/lib/security";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const nom = formData.get("nom") as string;
    const prenom = formData.get("prenom") as string;
    const email = formData.get("email") as string;
    const emailConfirm = formData.get("emailConfirm") as string;
    const telephone = formData.get("telephone") as string;
    const sport = formData.get("sport") as string | null;
    const dateNaissanceRaw = formData.get("dateNaissance") as string | null;
    const tailleRaw = formData.get("taille") as string | null;
    const poidsRaw = formData.get("poids") as string | null;
    const objectif = formData.get("objectif") as string | null;
    const antecedentsRaw = formData.get("antecedents") as string | null;
    const traitements = formData.get("traitements") as string | null;
    const contreIndications = formData.get("contreIndications") as string | null;
    const password = formData.get("password") as string;
    const passwordConfirm = formData.get("passwordConfirm") as string;
    const avatar = formData.get("avatar") as File | null;
    const cguVersion = formData.get("cguVersion") as string | null;

    // Validation
    if (!nom || !prenom || !email || !telephone || !password) {
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
        { error: "Les adresses email temporaires ou jetables ne sont pas acceptées." },
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
    if (!cguVersion) {
      return NextResponse.json(
        { error: "L'acceptation des Conditions Générales d'Utilisation est obligatoire." },
        { status: 400 }
      );
    }

    // Check if email already exists (in both AthleteUser and Professionnel)
    const existingAthlete = await prisma.athleteUser.findUnique({ where: { email } });
    if (existingAthlete) {
      return NextResponse.json(
        { error: "Un compte athlète avec cet email existe déjà." },
        { status: 409 }
      );
    }
    const existingPro = await prisma.professionnel.findUnique({ where: { email } });
    if (existingPro) {
      return NextResponse.json(
        { error: "Un compte professionnel avec cet email existe déjà." },
        { status: 409 }
      );
    }

    // Save avatar
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification code
    const verifyCode = generateVerifyCode();
    const verifyExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Parse date & numbers
    const dateNaissance = dateNaissanceRaw ? new Date(dateNaissanceRaw) : null;
    const taille = tailleRaw ? parseFloat(tailleRaw) : null;
    const poids = poidsRaw ? parseFloat(poidsRaw) : null;
    let antecedents: string[] = [];
    if (antecedentsRaw) {
      try { antecedents = JSON.parse(antecedentsRaw); } catch { /* ignore */ }
    }

    // Create athlete user
    const athleteUser = await prisma.athleteUser.create({
      data: {
        nom,
        prenom,
        email,
        telephone,
        password: hashedPassword,
        sport: sport || null,
        dateNaissance,
        taille: taille && !isNaN(taille) ? taille : null,
        poids: poids && !isNaN(poids) ? poids : null,
        objectif: objectif || null,
        antecedents,
        traitements: traitements || null,
        contreIndications: contreIndications || null,
        avatarPath,
        emailVerified: false,
        emailVerifyToken: verifyCode,
        emailVerifyExpires: verifyExpires,
        acceptedCguVersion: cguVersion,
        acceptedCguAt: new Date(),
        acceptedCguIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      },
    });

    // Send verification email (non-blocking)
    sendVerificationEmail({ to: email, prenom, code: verifyCode }).catch((err) => {
      console.error("[Inscription Athlete] Failed to send verification email:", err);
    });

    return NextResponse.json(
      {
        message: "Inscription réussie ! Un code de vérification a été envoyé à votre adresse email.",
        id: athleteUser.id,
        requiresEmailVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur inscription athlète:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'inscription." },
      { status: 500 }
    );
  }
}

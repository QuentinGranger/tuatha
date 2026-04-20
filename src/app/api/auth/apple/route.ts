import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";

export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;
    const { calendarUrl } = await request.json();

    if (!calendarUrl) {
      return NextResponse.json(
        { error: "URL du calendrier requis." },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      const url = new URL(calendarUrl);
      if (!["http:", "https:", "webcal:"].includes(url.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "URL de calendrier invalide. Utilisez une URL webcal:// ou https://" },
        { status: 400 }
      );
    }

    await prisma.calendrierSync.upsert({
      where: {
        professionnelId_type: {
          professionnelId: pro.id,
          type: "apple",
        },
      },
      update: {
        actif: true,
        accessToken: calendarUrl,
      },
      create: {
        type: "apple",
        actif: true,
        accessToken: calendarUrl,
        professionnelId: pro.id,
      },
    });

    return NextResponse.json({ message: "Calendrier Apple connecté !" }, { status: 201 });
  } catch (error) {
    console.error("Apple Calendar error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la connexion au calendrier Apple." },
      { status: 500 }
    );
  }
});

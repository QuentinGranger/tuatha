import { NextRequest, NextResponse } from "next/server";
import { secrets } from "@/lib/vault";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";

const GOOGLE_MAPS_API_KEY = secrets.googleMapsApiKey();

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(`places:${getIP(request)}`, RATE_LIMITS.placesApi);
  if (limited) return limited;

  const placeId = request.nextUrl.searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "placeId requis" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "formattedAddress,location,displayName",
      },
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Places details error:", error);
      return NextResponse.json({ error: "Place introuvable" }, { status: 404 });
    }

    const data = await res.json();

    return NextResponse.json({
      address: data.formattedAddress || "",
      latitude: data.location?.latitude || 0,
      longitude: data.location?.longitude || 0,
      placeId,
    });
  } catch (error) {
    console.error("Places details error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

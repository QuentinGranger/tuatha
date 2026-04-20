import { NextRequest, NextResponse } from "next/server";
import { secrets } from "@/lib/vault";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";
import { incident } from "@/lib/incidentResponse";

const GOOGLE_MAPS_API_KEY = secrets.googleMapsApiKey();

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(`places:${getIP(request)}`, RATE_LIMITS.placesApi);
  if (limited) return limited;

  const input = request.nextUrl.searchParams.get("input");

  if (!input || input.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (incident.isIntegrationKilled("google")) {
    return NextResponse.json({ suggestions: [], killSwitch: true });
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["fr"],
        languageCode: "fr",
        includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Places autocomplete error:", error);
      return NextResponse.json({ suggestions: [] });
    }

    const data = await res.json();

    const suggestions = (data.suggestions || [])
      .filter((s: Record<string, unknown>) => s.placePrediction)
      .map((s: { placePrediction: { placeId: string; text: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }) => ({
        placeId: s.placePrediction.placeId,
        description: s.placePrediction.text.text,
        mainText: s.placePrediction.structuredFormat?.mainText?.text || "",
        secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || "",
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Places autocomplete error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}

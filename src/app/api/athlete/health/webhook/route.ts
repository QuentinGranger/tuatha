import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDecrypted } from "@/lib/encryption";

/**
 * POST /api/athlete/health/webhook
 * Receives push notifications from health providers (Garmin, Polar, WHOOP, Oura).
 *
 * Garmin Health API sends push notifications with summary data when users sync.
 * Each provider has slightly different payload formats.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // ─── Garmin Push Notifications ───
    // Garmin sends arrays of data: dailies[], sleeps[], activities[], etc.

    const dataTypes = ["dailies", "sleeps", "activities", "bodyComps", "stressDetails", "userMetrics"];
    let processed = false;

    for (const dataType of dataTypes) {
      const items = payload[dataType];
      if (!Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        const userAccessToken = item.userAccessToken;
        if (!userAccessToken) continue;

        // Find the connection by access token (tokens are encrypted at rest)
        const garminConns = await prisma.healthAppConnection.findMany({
          where: { provider: "GARMIN", status: "connected" },
        });
        const connection = garminConns.find((c) => ensureDecrypted(c.accessToken) === userAccessToken);
        if (!connection) continue;

        const dateStr = item.calendarDate || item.summaryDate || new Date().toISOString().slice(0, 10);
        const date = new Date(dateStr + "T00:00:00.000Z");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const points: any[] = [];
        const base = { connectionId: connection.id, athleteUserId: connection.athleteUserId, date };

        if (dataType === "dailies") {
          if (item.steps != null)
            points.push({ ...base, category: "steps", value: item.steps, unit: "count" });
          if (item.totalKilocalories != null)
            points.push({ ...base, category: "calories", value: item.totalKilocalories, unit: "kcal" });
          if (item.totalDistanceInMeters != null)
            points.push({ ...base, category: "distance", value: +(item.totalDistanceInMeters / 1000).toFixed(2), unit: "km" });
          if (item.activeTimeInSeconds != null)
            points.push({ ...base, category: "active_minutes", value: Math.round(item.activeTimeInSeconds / 60), unit: "min" });
          if (item.averageHeartRateInBeatsPerMinute != null)
            points.push({ ...base, category: "heart_rate", value: item.averageHeartRateInBeatsPerMinute, unit: "bpm",
              metadata: {
                resting: item.restingHeartRateInBeatsPerMinute,
                max: item.maxHeartRateInBeatsPerMinute,
                avg: item.averageHeartRateInBeatsPerMinute,
              },
            });
          if (item.averageStressLevel != null)
            points.push({ ...base, category: "stress", value: item.averageStressLevel, unit: "score" });
        }

        if (dataType === "sleeps") {
          if (item.durationInSeconds != null)
            points.push({ ...base, category: "sleep", value: +(item.durationInSeconds / 3600).toFixed(2), unit: "hours",
              metadata: {
                deep: item.deepSleepDurationInSeconds,
                light: item.lightSleepDurationInSeconds,
                rem: item.remSleepInSeconds,
                awake: item.awakeDurationInSeconds,
                score: item.overallSleepScore?.value,
                spo2: item.averageSpO2Value,
              },
            });
          if (item.averageSpO2Value != null)
            points.push({ ...base, category: "spo2", value: item.averageSpO2Value, unit: "%" });
        }

        if (dataType === "bodyComps") {
          if (item.weightInGrams != null)
            points.push({ ...base, category: "body_weight", value: +(item.weightInGrams / 1000).toFixed(1), unit: "kg" });
          if (item.bodyFatPercentage != null)
            points.push({ ...base, category: "body_fat", value: item.bodyFatPercentage, unit: "%" });
        }

        // Upsert each data point
        for (const dp of points) {
          await prisma.healthDataPoint.upsert({
            where: {
              connectionId_category_date: {
                connectionId: dp.connectionId,
                category: dp.category,
                date: dp.date,
              },
            },
            create: dp,
            update: { value: dp.value, metadata: dp.metadata || undefined },
          });
        }

        // Update lastSyncAt
        if (points.length > 0) {
          await prisma.healthAppConnection.update({
            where: { id: connection.id },
            data: { lastSyncAt: new Date(), lastSyncError: null },
          });
          processed = true;
          console.log(`Garmin webhook: ${dataType} → ${points.length} points for athlete ${connection.athleteUserId}`);
        }
      }
    }

    if (!processed) {
      console.log("Health webhook: no matching data processed", Object.keys(payload));
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Health webhook error:", error);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}

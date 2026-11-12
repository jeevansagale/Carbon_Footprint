import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────
function highestCategory(
  transport: number,
  energy: number,
  food: number,
  waste: number
): string {
  const map: Record<string, number> = { Transport: transport, Energy: energy, Food: food, Waste: waste };
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0][0];
}

function privacySafeName(name: string | undefined | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  }
  return "Anonymous User";
}

function calculateCloudEcoScore(annualTonnesCO2: number): number {
  const tonnes = Number.isFinite(annualTonnesCO2) ? Math.max(0, annualTonnesCO2) : benchmarks.poor;
  const benchmarks = {
    excellent: 1.0,
    good: 1.5,
    average: 2.5,
    belowAverage: 4.0,
    poor: 4.0,
  };

  let score: number;
  if (tonnes <= benchmarks.excellent) {
    score = Math.round(90 + (1 - tonnes / benchmarks.excellent) * 10);
  } else if (tonnes <= benchmarks.good) {
    const progress = (tonnes - benchmarks.excellent) / (benchmarks.good - benchmarks.excellent);
    score = Math.round(90 - progress * 15);
  } else if (tonnes <= benchmarks.average) {
    const progress = (tonnes - benchmarks.good) / (benchmarks.average - benchmarks.good);
    score = Math.round(75 - progress * 20);
  } else if (tonnes <= benchmarks.belowAverage) {
    const progress = (tonnes - benchmarks.average) / (benchmarks.belowAverage - benchmarks.average);
    score = Math.round(55 - progress * 25);
  } else {
    score = Math.max(0, Math.round(30 * Math.exp(-(tonnes - benchmarks.belowAverage) / 3)));
  }

  return Math.max(0, Math.min(100, score));
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Function: onAssessmentCreated
// Aggregates assessment data into communityStats, communityLeaderboard, and communityReports.
// Correctly parses V2 assessment schema (emissions object) and V1 flat fields.
// ─────────────────────────────────────────────────────────────────────────────
export const onAssessmentCreated = onDocumentCreated(
  "users/{userId}/assessments/{assessmentId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = event.params.userId;
    const assessmentId = event.params.assessmentId;

    // 1. Safe extraction supporting V2 assessment schema (emissions object) & V1 flat fields
    const totalKgCO2 = typeof data.emissions?.totalKgCO2PerYear === "number"
      ? data.emissions.totalKgCO2PerYear
      : (typeof data.totalEmission === "number" ? data.totalEmission : 0);

    const annualEstimate = typeof data.emissions?.totalTonnesCO2PerYear === "number"
      ? data.emissions.totalTonnesCO2PerYear
      : (typeof data.annualEstimate === "number" ? data.annualEstimate : parseFloat((totalKgCO2 / 1000).toFixed(2)));

    const transportEmission = data.emissions?.breakdown?.transport ?? (data.transportEmission || 0);
    const energyEmission    = data.emissions?.breakdown?.energy    ?? (data.energyEmission || 0);
    const foodEmission      = data.emissions?.breakdown?.food      ?? (data.foodEmission || 0);
    const wasteEmission     = (data.emissions?.breakdown?.waste || 0) + (data.emissions?.breakdown?.shopping || 0) || (data.wasteEmission || 0);

    const ecoScore = typeof data.ecoScore === "number"
      ? data.ecoScore
      : calculateCloudEcoScore(annualEstimate);

    const ecoLabel = data.ecoLabel || (ecoScore >= 85 ? "Low Carbon" : ecoScore >= 70 ? "Moderate" : ecoScore >= 50 ? "Average" : "High Impact");

    // 2. Fetch user for displayName checking 'name' first, then 'displayName'
    const userSnap = await db.collection("users").doc(userId).get();
    let rawName = "Eco User";
    if (userSnap.exists) {
      const userData = userSnap.data();
      rawName = userData?.name || userData?.displayName || "Eco User";
    }

    const topCategory = highestCategory(transportEmission, energyEmission, foodEmission, wasteEmission);
    const safeName = privacySafeName(rawName);

    const statsRef = db.collection("communityStats").doc("global");
    const leaderboardRef = db.collection("communityLeaderboard").doc(userId);
    const reportRef = db.collection("communityReports").doc(assessmentId);

    try {
      await db.runTransaction(async (transaction) => {
        const statsSnap = await transaction.get(statsRef);
        const existingLeader = await transaction.get(leaderboardRef);

        // Safe initial default structure if communityStats/global does not exist yet (fresh project)
        const prev = statsSnap.exists ? statsSnap.data()! : {
          totalReports: 0,
          totalCO2Tracked: 0,
          averageAnnualCO2: 0,
          averageEcoScore: 0,
          emissionBreakdown: { transport: 0, energy: 0, food: 0, waste: 0 },
        };
        const existingScore = existingLeader.exists ? (existingLeader.data()?.ecoScore || 0) : 0;

        const prevReports = prev.totalReports || 0;
        const prevTotal = prev.totalCO2Tracked || 0;
        const prevBreakdown = prev.emissionBreakdown || { transport: 0, energy: 0, food: 0, waste: 0 };
        const prevScoreSum = (prev.averageEcoScore || 0) * prevReports;

        const newReports = prevReports + 1;
        const newTotalCO2 = prevTotal + totalKgCO2;
        const newAvgCO2 = parseFloat(((newTotalCO2 / 1000) / newReports).toFixed(3));
        const newAvgScore = parseFloat(((prevScoreSum + ecoScore) / newReports).toFixed(1));
        
        const newBreakdown = {
          transport: prevBreakdown.transport + transportEmission,
          energy: prevBreakdown.energy + energyEmission,
          food: prevBreakdown.food + foodEmission,
          waste: prevBreakdown.waste + wasteEmission,
        };

        // 1. Write/merge aggregated stats
        transaction.set(
          statsRef,
          {
            totalReports: newReports,
            totalCO2Tracked: newTotalCO2,
            averageAnnualCO2: newAvgCO2,
            averageEcoScore: newAvgScore,
            emissionBreakdown: newBreakdown,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 2. Write/overwrite leaderboard entry (best score wins)
        if (ecoScore >= existingScore || !existingLeader.exists) {
          transaction.set(leaderboardRef, {
            displayName: safeName,
            ecoScore,
            annualEstimate,
            ecoLabel,
            highestCategory: topCategory,
            isAnonymous: existingLeader.exists ? (existingLeader.data()?.isAnonymous || false) : false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // 3. Write anonymized recent report
        transaction.set(reportRef, {
          displayName: safeName,
          ecoScore,
          annualEstimate,
          ecoLabel,
          highestCategory: topCategory,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      console.log(`Successfully aggregated assessment ${assessmentId}`);
    } catch (err) {
      console.error(`Error aggregating assessment ${assessmentId}:`, err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Function: onAssessmentDeleted
// Handles removing an assessment from community aggregates safely.
// ─────────────────────────────────────────────────────────────────────────────
export const onAssessmentDeleted = onDocumentDeleted(
  "users/{userId}/assessments/{assessmentId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = event.params.userId;
    const assessmentId = event.params.assessmentId;

    const totalKgCO2 = typeof data.emissions?.totalKgCO2PerYear === "number"
      ? data.emissions.totalKgCO2PerYear
      : (typeof data.totalEmission === "number" ? data.totalEmission : 0);

    const annualEstimate = typeof data.emissions?.totalTonnesCO2PerYear === "number"
      ? data.emissions.totalTonnesCO2PerYear
      : (typeof data.annualEstimate === "number" ? data.annualEstimate : parseFloat((totalKgCO2 / 1000).toFixed(2)));

    const transportEmission = data.emissions?.breakdown?.transport ?? (data.transportEmission || 0);
    const energyEmission    = data.emissions?.breakdown?.energy    ?? (data.energyEmission || 0);
    const foodEmission      = data.emissions?.breakdown?.food      ?? (data.foodEmission || 0);
    const wasteEmission     = (data.emissions?.breakdown?.waste || 0) + (data.emissions?.breakdown?.shopping || 0) || (data.wasteEmission || 0);

    const ecoScore = typeof data.ecoScore === "number"
      ? data.ecoScore
      : calculateCloudEcoScore(annualEstimate);

    const statsRef = db.collection("communityStats").doc("global");
    const leaderboardRef = db.collection("communityLeaderboard").doc(userId);
    const reportRef = db.collection("communityReports").doc(assessmentId);

    try {
      await db.runTransaction(async (transaction) => {
        const statsSnap = await transaction.get(statsRef);
        if (!statsSnap.exists) return;

        const prev = statsSnap.data()!;
        const prevReports = prev.totalReports || 1;
        const newReports = Math.max(0, prevReports - 1);

        if (newReports === 0) {
          transaction.set(statsRef, {
            totalReports: 0,
            totalCO2Tracked: 0,
            averageAnnualCO2: 0,
            averageEcoScore: 0,
            emissionBreakdown: { transport: 0, energy: 0, food: 0, waste: 0 },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          const prevTotal = prev.totalCO2Tracked || 0;
          const newTotal = Math.max(0, prevTotal - totalKgCO2);
          
          const prevScoreSum = (prev.averageEcoScore || 0) * prevReports;
          const newAvgScore = parseFloat(((prevScoreSum - ecoScore) / newReports).toFixed(1));
          const newAvgCO2 = parseFloat(((newTotal / 1000) / newReports).toFixed(3));

          const prevBreakdown = prev.emissionBreakdown || { transport: 0, energy: 0, food: 0, waste: 0 };
          const newBreakdown = {
            transport: Math.max(0, prevBreakdown.transport - transportEmission),
            energy: Math.max(0, prevBreakdown.energy - energyEmission),
            food: Math.max(0, prevBreakdown.food - foodEmission),
            waste: Math.max(0, prevBreakdown.waste - wasteEmission),
          };

          transaction.set(statsRef, {
            totalReports: newReports,
            totalCO2Tracked: newTotal,
            averageAnnualCO2: newAvgCO2,
            averageEcoScore: Math.max(0, newAvgScore),
            emissionBreakdown: newBreakdown,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        // Check if user has other assessments remaining
        const userAssessmentsSnap = await transaction.get(db.collection("users").doc(userId).collection("assessments").limit(1));
        const hasRemaining = !userAssessmentsSnap.empty;

        transaction.delete(reportRef);

        if (!hasRemaining) {
          transaction.delete(leaderboardRef);
        }
      });
      console.log(`Successfully removed assessment ${assessmentId} from aggregates`);
    } catch (err) {
      console.error(`Error removing assessment ${assessmentId} from aggregates:`, err);
    }
  }
);

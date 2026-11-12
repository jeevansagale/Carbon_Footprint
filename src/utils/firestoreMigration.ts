/**
 * Firestore Backward-Compatible Document Migration & Schema Normalizer
 * Ensures older assessment objects seamlessly match v2.0 standards without data loss.
 */

import { CalculationResult } from './calculationEngine';

export interface NormalizedAssessmentDocument {
  id: string;
  userId: string;
  timestamp: string;
  calculatorVersion: string;
  datasetVersion: string;
  aiPromptVersion: string;
  aiModel: string;
  mode: 'quick' | 'detailed';
  location: {
    country: string;
    state: string;
    district?: string;
    city?: string;
    dwelling?: string;
  };
  emissions: {
    totalKgCO2PerYear: number;
    totalTonnesCO2PerYear: number;
    breakdown: {
      transport: number;
      energy: number;
      food: number;
      waste: number;
      shopping: number;
    };
    percentages?: {
      transport: number;
      energy: number;
      food: number;
      waste: number;
      shopping: number;
    };
  };
  confidence: {
    overallScore: number;
    overallRating: 'HIGH' | 'MEDIUM' | 'ESTIMATE';
    rationales?: string[];
  };
  answers: Record<string, any>;
  aiAdvice: any[];
  status: 'approved' | 'pending_review' | 'rejected';
  isTestAccount?: boolean;
}

/**
 * Normalizes any legacy or missing fields in a Firestore assessment document.
 */
export function normalizeAssessmentDocument(doc: any, docId?: string): NormalizedAssessmentDocument {
  const safeId = docId || doc?.id || `legacy_${Date.now()}`;
  const safeUserId = doc?.userId || doc?.uid || 'anonymous';
  const safeTimestamp = doc?.timestamp || doc?.createdAt || '';

  // Only preserve values actually present in the stored document.
  // Missing legacy fields must not be replaced with invented footprint estimates.
  const firstFiniteNonNegative = (...values: unknown[]): number | undefined => {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value);
      }
    }
    return undefined;
  };

  const rawTotalKg = firstFiniteNonNegative(
    doc?.emissions?.totalKgCO2PerYear,
    doc?.totalEmissions,
    doc?.emissions?.total
  ) ?? 0;
  const rawTotalTonnes = firstFiniteNonNegative(
    doc?.emissions?.totalTonnesCO2PerYear,
    doc?.annualEstimate
  ) ?? Math.round((rawTotalKg / 1000) * 100) / 100;

  const rawBreakdown = doc?.emissions?.breakdown ?? doc?.breakdown ?? {};
  const safeBreakdown = {
    transport: firstFiniteNonNegative(rawBreakdown.transport) ?? 0,
    energy: firstFiniteNonNegative(rawBreakdown.energy) ?? 0,
    food: firstFiniteNonNegative(rawBreakdown.food) ?? 0,
    waste: firstFiniteNonNegative(rawBreakdown.waste) ?? 0,
    shopping: firstFiniteNonNegative(rawBreakdown.shopping) ?? 0,
  };
  const breakdownTotal = Object.values(safeBreakdown).reduce((sum, value) => sum + value, 0);

  const storedPercentages = doc?.emissions?.percentages ?? doc?.percentages;
  const derivedPercentages = {
    transport: breakdownTotal > 0 ? (safeBreakdown.transport / breakdownTotal) * 100 : 0,
    energy: breakdownTotal > 0 ? (safeBreakdown.energy / breakdownTotal) * 100 : 0,
    food: breakdownTotal > 0 ? (safeBreakdown.food / breakdownTotal) * 100 : 0,
    waste: breakdownTotal > 0 ? (safeBreakdown.waste / breakdownTotal) * 100 : 0,
    shopping: breakdownTotal > 0 ? (safeBreakdown.shopping / breakdownTotal) * 100 : 0,
  };
  const safePercentages = {
    transport: firstFiniteNonNegative(storedPercentages?.transport) ?? derivedPercentages.transport,
    energy: firstFiniteNonNegative(storedPercentages?.energy) ?? derivedPercentages.energy,
    food: firstFiniteNonNegative(storedPercentages?.food) ?? derivedPercentages.food,
    waste: firstFiniteNonNegative(storedPercentages?.waste) ?? derivedPercentages.waste,
    shopping: firstFiniteNonNegative(storedPercentages?.shopping) ?? derivedPercentages.shopping,
  };

  // Missing input-coverage metadata is unknown, not a fabricated 75% score.
  const storedConfidence = firstFiniteNonNegative(
    doc?.confidence?.overallScore,
    doc?.confidence?.score
  );
  const safeConfidence = {
    overallScore: Math.min(100, storedConfidence ?? 0),
    overallRating: (['HIGH', 'MEDIUM', 'ESTIMATE'].includes(doc?.confidence?.overallRating)
      ? doc.confidence.overallRating
      : storedConfidence !== undefined && storedConfidence >= 85 ? 'HIGH'
      : storedConfidence !== undefined && storedConfidence >= 70 ? 'MEDIUM'
      : 'ESTIMATE') as 'HIGH' | 'MEDIUM' | 'ESTIMATE',
    rationales: Array.isArray(doc?.confidence?.rationales)
      ? doc.confidence.rationales
      : ['Input-coverage metadata was not stored for this legacy assessment.'],
  };

  // Location details remain unknown when the original assessment did not store them.
  const safeLocation = {
    country: doc?.location?.country || 'India',
    state: doc?.location?.state || doc?.state || 'Unknown',
    district: doc?.location?.district || doc?.district,
    city: doc?.location?.city || doc?.city,
    dwelling: doc?.location?.dwelling || doc?.dwelling,
  };

  return {
    id: safeId,
    userId: safeUserId,
    timestamp: safeTimestamp,
    calculatorVersion: doc?.calculatorVersion || 'unknown',
    datasetVersion: doc?.datasetVersion || 'unknown',
    aiPromptVersion: doc?.aiPromptVersion || 'unknown',
    aiModel: doc?.aiModel || 'unknown',
    mode: doc?.mode || 'quick',
    location: safeLocation,
    emissions: {
      totalKgCO2PerYear: Math.round(rawTotalKg * 10) / 10,
      totalTonnesCO2PerYear: rawTotalTonnes,
      breakdown: safeBreakdown,
      percentages: safePercentages,
    },
    confidence: safeConfidence,
    answers: doc?.answers || doc?.inputs || {},
    aiAdvice: Array.isArray(doc?.aiAdvice) ? doc.aiAdvice : Array.isArray(doc?.recommendations) ? doc.recommendations : [],
    status: doc?.status || 'pending_review',
    isTestAccount: Boolean(doc?.isTestAccount)
  };
}

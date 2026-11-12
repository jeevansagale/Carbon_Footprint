/**
 * Eco Score Calculator
 * Computes a 0-100 heuristic eco score and letter grade based on annual CO2 emissions.
 * Uses Indian per-capita emission benchmarks.
 *
 * Sources:
 * - World Bank India per-capita CO2: ~1.9 tonnes/year (2023)
 * - MoEFCC national targets
 *
 * @module core/calculation/ecoScore
 */

import type { EcoScoreResult } from '../../types/assessment';

/**
 * India-specific per-capita CO2 benchmarks (tonnes/year).
 * Used as configured scoring thresholds; these are not empirical population percentiles.
 */
const BENCHMARKS = {
  /** Excellent: below 1.0 tonne (top ~10% of Indian population) */
  excellent: 1.0,
  /** Good: 1.0 - 1.5 tonnes (top ~25%) */
  good: 1.5,
  /** Average: 1.5 - 2.5 tonnes (Indian national average ~1.9t) */
  average: 2.5,
  /** Below average: 2.5 - 4.0 tonnes */
  belowAverage: 4.0,
  /** Poor: above 4.0 tonnes */
  poor: 4.0,
};

/**
 * Calculate eco score from annual CO2 emissions.
 *
 * @param annualTonnesCO2 - Annual CO2 emission in tonnes
 * @returns Eco score result with score, grade, label, and percentile
 */
export function calculateEcoScore(annualTonnesCO2: number): EcoScoreResult {
  // Clamp to non-negative
  const tonnes = Math.max(0, annualTonnesCO2);

  let score: number;
  if (tonnes <= BENCHMARKS.excellent) {
    // Lower emissions receive higher scores in the excellent band.
    score = Math.round(90 + (1 - tonnes / BENCHMARKS.excellent) * 10);
  } else if (tonnes <= BENCHMARKS.good) {
    // 90 at 1.0 tonnes, decreasing to 75 at 1.5 tonnes.
    const progress = (tonnes - BENCHMARKS.excellent) / (BENCHMARKS.good - BENCHMARKS.excellent);
    score = Math.round(90 - progress * 15);
  } else if (tonnes <= BENCHMARKS.average) {
    // 75 at 1.5 tonnes, decreasing to 55 at 2.5 tonnes.
    const progress = (tonnes - BENCHMARKS.good) / (BENCHMARKS.average - BENCHMARKS.good);
    score = Math.round(75 - progress * 20);
  } else if (tonnes <= BENCHMARKS.belowAverage) {
    // 55 at 2.5 tonnes, decreasing to 30 at 4.0 tonnes.
    const progress = (tonnes - BENCHMARKS.average) / (BENCHMARKS.belowAverage - BENCHMARKS.average);
    score = Math.round(55 - progress * 25);
  } else {
    // Exponential decay beyond the highest emissions threshold.
    score = Math.max(0, Math.round(30 * Math.exp(-(tonnes - BENCHMARKS.belowAverage) / 3)));
  }

  score = Math.max(0, Math.min(100, score));

  let grade: EcoScoreResult['grade'];
  let label: string;
  if (score >= 90) { grade = 'A+'; label = 'Outstanding'; }
  else if (score >= 80) { grade = 'A'; label = 'Excellent'; }
  else if (score >= 70) { grade = 'B+'; label = 'Very Good'; }
  else if (score >= 60) { grade = 'B'; label = 'Good'; }
  else if (score >= 50) { grade = 'C+'; label = 'Above Average'; }
  else if (score >= 40) { grade = 'C'; label = 'Average'; }
  else if (score >= 25) { grade = 'D'; label = 'Below Average'; }
  else { grade = 'F'; label = 'Needs Improvement'; }

  // Heuristic relative index only; this is not a measured population percentile.
  const percentile = Math.max(1, Math.min(99, Math.round(
    100 * Math.exp(-tonnes / 3.0)
  )));

  return { score, grade, label, percentile };
}
import { describe, expect, it } from 'vitest';
import { calculateEcoScore } from './ecoScore';

describe('calculateEcoScore', () => {
  it('never increases the score as annual emissions increase', () => {
    const emissions = [0, 0.5, 1, 1.1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 8, 12];
    const scores = emissions.map(value => calculateEcoScore(value).score);
    for (let index = 1; index < scores.length; index += 1) {
      expect(scores[index]).toBeLessThanOrEqual(scores[index - 1]);
    }
  });

  it('has descending scores across each configured benchmark boundary', () => {
    expect(calculateEcoScore(1).score).toBeGreaterThan(calculateEcoScore(1.5).score);
    expect(calculateEcoScore(1.5).score).toBeGreaterThan(calculateEcoScore(2.5).score);
    expect(calculateEcoScore(2.5).score).toBeGreaterThan(calculateEcoScore(4).score);
  });

  it('returns a finite bounded score for invalid numeric input', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      const result = calculateEcoScore(value);
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('keeps the score within 0-100 for negative and extreme values', () => {
    for (const value of [-100, 0, 1, 4, 100, 10000]) {
      const score = calculateEcoScore(value).score;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

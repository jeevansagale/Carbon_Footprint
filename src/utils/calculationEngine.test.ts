import { describe, it, expect } from 'vitest';
import { calculateEmissions } from './calculationEngine';
import { calculateAssessmentConfidence } from './confidenceCalculator';
import { normalizeAssessmentDocument } from './firestoreMigration';
import { calculateFlightEmission, calculateHaversineDistanceKm } from '../data/datasets/transport/airports';
import { electricityGridDataset } from '../data/datasets/electricity/gridFactors';

describe('EcoTrack AI — Scientific Calculation Engine (v2.0)', () => {

  it('correctly resolves state-specific CEA grid factors for electricity', () => {
    // Himachal Pradesh has high hydro (0.12 kg CO2/kWh)
    const hpResult = calculateEmissions({
      state: 'Himachal Pradesh',
      electricityKWhKnown: true,
      electricityKWh: 300,
      householdMembers: 1
    });

    // Maharashtra grid factor (0.73 kg CO2/kWh)
    const mhResult = calculateEmissions({
      state: 'Maharashtra',
      electricityKWhKnown: true,
      electricityKWh: 300,
      householdMembers: 1
    });

    expect(hpResult.metadata.gridFactorUsed).toBe(0.12);
    expect(mhResult.metadata.gridFactorUsed).toBe(0.73);
    expect(hpResult.subBreakdown.electricity).toBeLessThan(mhResult.subBreakdown.electricity);
  });

  it('accurately calculates Haversine distance and ICAO aviation emissions', () => {
    // DEL (New Delhi) to BOM (Mumbai) ~ 1137 km
    const dist = calculateHaversineDistanceKm(28.5562, 77.1000, 19.0896, 72.8656);
    expect(dist).toBeGreaterThan(1100);
    expect(dist).toBeLessThan(1200);

    const flightRes = calculateFlightEmission('DEL', 'BOM', 'ECONOMY', true, 1);
    expect(flightRes.distanceKm).toBe(dist);
    expect(flightRes.totalEmissionKgCO2).toBeGreaterThan(300);
  });

  it('differentiates ARAI vehicle emissions for Petrol Hatchback vs SUV vs EV', () => {
    const petrolHatchback = calculateEmissions({
      ownsVehicle: true,
      vehicleCategoryKey: 'car_hatchback_petrol',
      dailyVehicleKm: 30
    });

    const petrolSuv = calculateEmissions({
      ownsVehicle: true,
      vehicleCategoryKey: 'car_suv_petrol',
      dailyVehicleKm: 30
    });

    const evCar = calculateEmissions({
      ownsVehicle: true,
      vehicleCategoryKey: 'car_electric',
      dailyVehicleKm: 30,
      state: 'Karnataka'
    });

    expect(petrolSuv.subBreakdown.vehicles).toBeGreaterThan(petrolHatchback.subBreakdown.vehicles);
    expect(evCar.subBreakdown.vehicles).toBeLessThan(petrolHatchback.subBreakdown.vehicles);
  });

  it('calculates precision confidence metrics and rationales', () => {
    const highConfidenceAnswers = {
      state: 'Delhi',
      electricityKWhKnown: true,
      electricityKWh: 250,
      ownsVehicle: true,
      vehicleCategoryKey: 'car_hatchback_petrol',
      exactDistanceProvided: true,
      dietType: 'lacto_vegetarian',
      foodWasteLevel: 'LOW'
    };

    const confidence = calculateAssessmentConfidence(highConfidenceAnswers);
    expect(confidence.overallScore).toBeGreaterThanOrEqual(80);
    expect(confidence.energy.rating).toBe('HIGH');
  });

  it('normalizes legacy Firestore documents without breaking or dropping fields', () => {
    const legacyDoc = {
      id: 'legacy_123',
      userId: 'user_456',
      totalEmissions: 2800,
      state: 'Gujarat'
    };

    const normalized = normalizeAssessmentDocument(legacyDoc);
    expect(normalized.id).toBe('legacy_123');
    expect(normalized.userId).toBe('user_456');
    expect(normalized.emissions.totalKgCO2PerYear).toBe(2800);
    expect(normalized.location.country).toBe('India');
    expect(normalized.confidence.overallScore).toBe(0);
    expect(normalized.confidence.overallRating).toBe('ESTIMATE');
    expect(normalized.emissions.breakdown.transport).toBe(0);
    expect(normalized.location.state).toBe('Gujarat');
    expect(normalized.calculatorVersion).toBe('1.0.0-legacy');
  });

  it('does not fabricate emissions or location fields when a legacy document omits them', () => {
    const normalized = normalizeAssessmentDocument({ id: 'missing_fields', userId: 'user_1' });
    expect(normalized.emissions.totalKgCO2PerYear).toBe(0);
    expect(normalized.emissions.totalTonnesCO2PerYear).toBe(0);
    expect(normalized.emissions.breakdown).toEqual({ transport: 0, energy: 0, food: 0, waste: 0, shopping: 0 });
    expect(normalized.emissions.percentages).toEqual({ transport: 0, energy: 0, food: 0, waste: 0, shopping: 0 });
    expect(normalized.confidence.overallScore).toBe(0);
    expect(normalized.confidence.overallRating).toBe('ESTIMATE');
    expect(normalized.location.state).toBe('Unknown');
    expect(normalized.location.dwelling).toBeUndefined();
    expect(normalized.aiModel).toBe('unknown');
    expect(normalized.status).toBe('pending_review');
  });

  it('preserves explicit zero emissions instead of replacing them with legacy fallbacks', () => {
    const normalized = normalizeAssessmentDocument({
      emissions: {
        totalKgCO2PerYear: 0,
        totalTonnesCO2PerYear: 0,
        breakdown: { transport: 0, energy: 0, food: 0, waste: 0, shopping: 0 },
      },
    });
    expect(normalized.emissions.totalKgCO2PerYear).toBe(0);
    expect(normalized.emissions.totalTonnesCO2PerYear).toBe(0);
    expect(Object.values(normalized.emissions.percentages).every(value => value === 0)).toBe(true);
  });
});

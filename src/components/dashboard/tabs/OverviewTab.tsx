/**
 * Overview Tab — Dashboard
 *
 * Shows: KPI widgets, Sustainability Score gauges, Insight card, Equivalent card.
 * Receives all pre-computed values from Dashboard.tsx — no Firestore calls here.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Leaf, Sparkles, Globe, Activity, TrendingDown } from 'lucide-react';
import { KPIWidget, GaugeWidget } from '../../../visualization';
import { InsightCard } from '../InsightCard';
import { EquivalentCard } from '../EquivalentCard';
import { semantic, solar } from '../../../design';

interface BreakdownShape {
  transport: number;
  energy: number;
  food: number;
  waste: number;
  shopping: number;
}

interface OverviewTabProps {
  totalKg: number;
  totalTonnes: number;
  ecoScore: number;
  confidenceScore: number;
  confidenceRating: string;
  vsIndiaPct: number;
  isLowerThanIndia: boolean;
  deltaVsPrev: number | null;
  prevKg: number | undefined;
  sparkData: number[];
  answers: any;
  breakdown: BreakdownShape;
  indiaAvgKg: number;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  totalKg,
  totalTonnes,
  ecoScore,
  confidenceScore,
  confidenceRating,
  vsIndiaPct,
  isLowerThanIndia,
  deltaVsPrev,
  prevKg,
  sparkData,
  answers,
  breakdown,
  indiaAvgKg,
}) => {
  const legacyResults = {
    transportEmissions: breakdown.transport,
    energyEmissions: breakdown.energy,
    foodEmissions: breakdown.food,
    wasteEmissions: breakdown.waste,
    totalEmissions: totalKg,
    annualEstimate: totalTonnes,
    ecoScore,
  } as any;

  const vsIndiaRatio = Math.min(100, Math.round((indiaAvgKg / Math.max(totalKg, 1)) * 100));

  return (
    <div className="space-y-6">
      {/* ── KPI Panels ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPIWidget
          label="Annual Footprint"
          value={totalTonnes.toString()}
          unit="t CO₂e"
          trend={
            deltaVsPrev !== null
              ? Math.round((deltaVsPrev / (prevKg || 1)) * 100)
              : undefined
          }
          trendLabel="vs previous"
          sparkData={sparkData}
          comparison={`${totalKg.toLocaleString()} kg CO₂e total`}
          status={isLowerThanIndia ? 'good' : 'warning'}
          icon={<Leaf className="w-4 h-4" />}
        />
        <KPIWidget
          label="Eco Score"
          value={ecoScore.toString()}
          unit="/100"
          comparison={ecoScore >= 70 ? 'Eco Champion' : 'Room to improve'}
          status={ecoScore >= 70 ? 'good' : ecoScore >= 40 ? 'warning' : 'critical'}
          icon={<Sparkles className="w-4 h-4" />}
        />
        <KPIWidget
          label="vs Indian Avg"
          value={`${Math.abs(vsIndiaPct)}%`}
          unit={isLowerThanIndia ? 'lower' : 'higher'}
          comparison="Based on 1.9t national baseline"
          status={isLowerThanIndia ? 'good' : 'warning'}
          icon={<Globe className="w-4 h-4" />}
        />
        <KPIWidget
          label="Input Coverage"
          value={`${confidenceScore}%`}
          unit={confidenceRating}
          comparison="Heuristic based on answer detail; not statistical accuracy"
          status={confidenceScore >= 80 ? 'good' : 'warning'}
          icon={<Activity className="w-4 h-4" />}
        />
      </div>

      {/* ── Sustainability Gauges ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <div className="surface-elevated p-6 rounded-3xl">
          <div className="flex items-center gap-2 mb-6">
            <TrendingDown className="w-4 h-4 text-emerald-700" />
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Sustainability Score</h3>
              <p className="text-[10px] text-[var(--text-muted)]">
                How do you compare against Indian benchmarks?
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <GaugeWidget value={ecoScore} label="Eco Score" size={150} />
            <div className="flex gap-8">
              <GaugeWidget
                value={confidenceScore}
                label="Input Coverage"
                size={100}
                color={semantic.info}
              />
              <GaugeWidget
                value={vsIndiaRatio}
                label="vs India Avg"
                size={100}
                color={solar.yellow}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Insight + Equivalent Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightCard answers={answers} results={legacyResults} />
        <EquivalentCard results={legacyResults} />
      </div>
    </div>
  );
};

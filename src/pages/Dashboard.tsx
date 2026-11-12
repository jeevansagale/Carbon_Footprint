/**
 * EcoTrack AI — Dashboard Page
 *
 * Four-tab architecture: Overview | Emissions | Goals | Leaderboard.
 * All calculations happen here; tabs receive pre-computed values as props.
 * Zero hardcoded environmental values — all data flows from AssessmentContext or Firestore.
 */

import React, { useState, useEffect } from 'react';
import { useAssessment } from '../context/AssessmentContext';
import { useAuth } from '../context/AuthContext';
import { getUserAssessments } from '../firebase/firestore';
import { NationalDataProvider } from '../data/providers/NationalDataProvider';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { EmptyDashboard } from '../components/dashboard/EmptyDashboard';
import { OverviewTab } from '../components/dashboard/tabs/OverviewTab';
import { EmissionsTab } from '../components/dashboard/tabs/EmissionsTab';
import { GoalsTab } from '../components/dashboard/tabs/GoalsTab';
import { LeaderboardTab } from '../components/dashboard/tabs/LeaderboardTab';
import { VisualizationDataProvider } from '../visualization';
import { Loader2, Activity, BarChart3, Leaf, Trophy } from 'lucide-react';
import { calculateEcoScore } from '../core/calculation/ecoScore';
import Tabs from '../components/ui/Tabs';

// ── Constants ────────────────────────────────────────────────────────────────

const INDIA_AVG_KG = NationalDataProvider.getIndiaAverageFootprintKg().data;

type TabId = 'overview' | 'emissions' | 'goals' | 'leaderboard';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',     label: 'Overview',     icon: <Activity  className="w-4 h-4" /> },
  { id: 'emissions',    label: 'Emissions',    icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'goals',        label: 'Goals',        icon: <Leaf      className="w-4 h-4" /> },
  { id: 'leaderboard',  label: 'Leaderboard',  icon: <Trophy    className="w-4 h-4" /> },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const { result: contextResult } = useAssessment();

  const [activeResult, setActiveResult] = useState<any | null>(contextResult);
  const [previousAssessment, setPreviousAssessment] = useState<any | null>(null);
  const [historyDocs, setHistoryDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Sync context result (set immediately after assessment completes)
  useEffect(() => {
    if (contextResult) setActiveResult(contextResult);
  }, [contextResult]);

  // Hydrate from Firestore when no in-session result exists
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    getUserAssessments(user.uid)
      .then(docs => {
        if (docs.length > 0) {
          if (!contextResult) {
            const latest = docs[0];
            const latestBreakdown = latest.emissions?.breakdown ?? { transport: 0, energy: 0, food: 0, waste: 0, shopping: 0 };
            const breakdownTotal = Object.values(latestBreakdown).reduce(
              (sum: number, value: unknown) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0),
              0
            );
            const fallbackPercentages = Object.fromEntries(
              Object.entries(latestBreakdown).map(([key, value]) => [
                key,
                breakdownTotal > 0 && typeof value === "number" ? (value / breakdownTotal) * 100 : 0,
              ])
            );
            setActiveResult({
              totalKgCO2PerYear:    latest.emissions?.totalKgCO2PerYear    ?? 0,
              totalTonnesCO2PerYear: latest.emissions?.totalTonnesCO2PerYear ?? 0,
              breakdown: latestBreakdown,
              percentages: latest.emissions?.percentages ?? fallbackPercentages,
              confidence: latest.confidence ?? { overallScore: 0, overallRating: 'ESTIMATE' },
              metadata: {
                gridFactorUsed: latest.metadata?.gridFactorUsed ?? 0,
                state: latest.location?.state || 'Unknown',
                calculatorVersion: '2.0.0',
                datasetVersion:    '2026.1',
              },
              // Preserve answers so InsightCard / ImprovementPreview work on refresh
              answers: latest.answers ?? {},
            });
          }
          if (docs.length > 1) setPreviousAssessment(docs[1]);
          setHistoryDocs(docs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.uid, contextResult]);

  // ── Early returns ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!activeResult) {
    return (
      <div className="min-h-screen pt-24 pb-16 relative flex items-center justify-center">
        <div className="absolute inset-0 mesh-bg" />
        <EmptyDashboard />
      </div>
    );
  }

  // ── Derived values (single source of truth for all tabs) ───────────────────

  const totalKg = activeResult.totalKgCO2PerYear ?? (activeResult.totalEmissions ?? 0);
  const totalTonnes = activeResult.totalTonnesCO2PerYear
    ?? Math.round((totalKg / 1000) * 100) / 100;

  const breakdown = activeResult.breakdown ?? {
    transport: activeResult.transportEmissions ?? 0,
    energy:    activeResult.energyEmissions    ?? 0,
    food:      activeResult.foodEmissions      ?? 0,
    waste:     activeResult.wasteEmissions     ?? 0,
    shopping:  0,
  };

  // Canonical EcoScore — one formula, one place
  const ecoScore        = calculateEcoScore(totalTonnes).score;
  const confidenceScore = activeResult.confidence?.overallScore ?? 0;
  const confidenceRating = activeResult.confidence?.overallRating ?? 'ESTIMATE';

  const vsIndiaPct      = Math.round(((totalKg - INDIA_AVG_KG) / INDIA_AVG_KG) * 100);
  const isLowerThanIndia = totalKg <= INDIA_AVG_KG;

  const prevKg       = previousAssessment?.emissions?.totalKgCO2PerYear;
  const deltaVsPrev  = prevKg ? Math.round(totalKg - prevKg) : null;

  const sparkData = VisualizationDataProvider.getSparklineData(
    historyDocs.length > 0
      ? historyDocs
      : [{ totalKgCO2PerYear: totalKg, createdAt: { seconds: Date.now() / 1000 } }]
  );

  const radarData    = VisualizationDataProvider.getRadarData(breakdown);
  const doughnutData = VisualizationDataProvider.getDoughnutData(breakdown);

  const categoryChartData = {
    labels: ['Transport', 'Energy', 'Food', 'Waste', 'Shopping'],
    datasets: [{
      label: 'Emissions (kg CO₂e/yr)',
      data: [
        Math.round(breakdown.transport || 0),
        Math.round(breakdown.energy    || 0),
        Math.round(breakdown.food      || 0),
        Math.round(breakdown.waste     || 0),
        Math.round(breakdown.shopping  || 0),
      ],
      backgroundColor: [
        'rgba(6, 182, 212, 0.55)', 'rgba(245, 158, 11, 0.55)', 'rgba(244, 63, 94, 0.55)',
        'rgba(139, 92, 246, 0.55)', 'rgba(99, 102, 241, 0.55)',
      ],
      borderColor: [
        'rgba(6, 182, 212, 1)', 'rgba(245, 158, 11, 1)', 'rgba(244, 63, 94, 1)',
        'rgba(139, 92, 246, 1)', 'rgba(99, 102, 241, 1)',
      ],
      borderWidth: 1.5,
    }],
  };

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pt-24 pb-16 relative">
      <div className="absolute inset-0 mesh-bg" />
      <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container-max mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
        <DashboardHeader date={formattedDate} />

        {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
        <Tabs items={TABS} value={activeTab} onChange={setActiveTab} />

        {/* ── Tab Panels ───────────────────────────────────────────────────── */}

        {activeTab === 'overview' && (
          <div
            id="tabpanel-overview"
            role="tabpanel"
            aria-labelledby="tab-overview"
          >
            <OverviewTab
              totalKg={totalKg}
              totalTonnes={totalTonnes}
              ecoScore={ecoScore}
              confidenceScore={confidenceScore}
              confidenceRating={confidenceRating}
              vsIndiaPct={vsIndiaPct}
              isLowerThanIndia={isLowerThanIndia}
              deltaVsPrev={deltaVsPrev}
              prevKg={prevKg}
              sparkData={sparkData}
              answers={activeResult.answers}
              breakdown={breakdown}
              indiaAvgKg={INDIA_AVG_KG}
            />
          </div>
        )}

        {activeTab === 'emissions' && (
          <div
            id="tabpanel-emissions"
            role="tabpanel"
            aria-labelledby="tab-emissions"
          >
            <EmissionsTab
              radarData={radarData}
              doughnutData={doughnutData}
              categoryChartData={categoryChartData}
              breakdown={breakdown}
              totalKg={totalKg}
              totalTonnes={totalTonnes}
              indiaAvgKg={INDIA_AVG_KG}
            />
          </div>
        )}

        {activeTab === 'goals' && (
          <div
            id="tabpanel-goals"
            role="tabpanel"
            aria-labelledby="tab-goals"
          >
            <GoalsTab
              activeResult={activeResult}
              totalKg={totalKg}
              totalTonnes={totalTonnes}
              ecoScore={ecoScore}
              breakdown={breakdown}
              historyDocs={historyDocs}
            />
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div
            id="tabpanel-leaderboard"
            role="tabpanel"
            aria-labelledby="tab-leaderboard"
          >
            <LeaderboardTab />
          </div>
        )}
      </div>
    </div>
  );
}
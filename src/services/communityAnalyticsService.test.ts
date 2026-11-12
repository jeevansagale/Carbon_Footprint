import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateCommunityAggregates, removeCommunityEntry } from './communityAnalyticsService';
import { runTransaction } from 'firebase/firestore';

vi.mock('../firebase/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, collection, id) => `${collection}/${id}`),
  collection: vi.fn((db, name) => name),
  serverTimestamp: vi.fn(() => 'TIMESTAMP'),
  runTransaction: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

describe('communityAnalyticsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leaves aggregation to the trusted Cloud Function after a new assessment', async () => {
    await updateCommunityAggregates({
      userId: 'user1',
      calculationId: 'calc1',
      displayName: 'Test User',
      transportEmission: 100,
      energyEmission: 200,
      foodEmission: 300,
      wasteEmission: 400,
      totalEmission: 1000,
      ecoScore: 80,
      ecoLabel: 'Good',
      annualEstimate: 1.0,
      totalUsers: 5,
    });

    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('leaves aggregate cleanup to the trusted Cloud Function after deletion', async () => {
    await removeCommunityEntry({
      calculationId: 'calc1',
      userId: 'user1',
      hasRemaining: false,
      removedEmission: 1000,
      removedScore: 80,
      removedBreakdown: { transport: 500, energy: 500, food: 0, waste: 0 },
    });

    expect(runTransaction).not.toHaveBeenCalled();
  });
});

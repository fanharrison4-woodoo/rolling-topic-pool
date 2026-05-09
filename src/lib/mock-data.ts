import { League, Player, Topic, Prediction, PoolState } from "./types";

export const LEAGUE: League = {
  id: "league-1",
  name: "Friends Prediction Pool",
  stakePerTopic: 5,
  currency: "USD",
  playerIds: ["player-1", "player-2", "player-3", "player-4", "player-5"],
};

export const PLAYERS: Player[] = [
  { id: "player-1", name: "Alex Chen",    avatarInitials: "AC", role: "admin"  },
  { id: "player-2", name: "Britta Park",  avatarInitials: "BP", role: "player" },
  { id: "player-3", name: "Carlos Diaz",  avatarInitials: "CD", role: "player" },
  { id: "player-4", name: "Dana Lee",     avatarInitials: "DL", role: "player" },
  { id: "player-5", name: "Eli Morgan",   avatarInitials: "EM", role: "player" },
];

// Simulated "current user" for the prototype
export const CURRENT_USER: Player = PLAYERS[1]; // Britta Park (player)

export const TOPICS: Topic[] = [
  {
    id: "topic-1",
    order: 1,
    title: "Super Bowl LVIX Winner",
    description: "Which team will win Super Bowl LVIX?",
    status: "settled",
    openAt:    "2025-01-01T00:00:00Z",
    closeAt:   "2025-02-09T18:30:00Z",
    settledAt: "2025-02-09T23:00:00Z",
    resolutionNote: "Philadelphia Eagles won 40-22 over the Kansas City Chiefs.",
    winnerIds: ["player-3"],
    poolAtSettlement: 50,
    payoutPerWinner: 50,
  },
  {
    id: "topic-2",
    order: 2,
    title: "2025 NBA Champions",
    description: "Which team will win the 2025 NBA Championship?",
    status: "settled",
    openAt:    "2025-02-10T00:00:00Z",
    closeAt:   "2025-06-01T00:00:00Z",
    settledAt: "2025-06-25T00:00:00Z",
    resolutionNote: "No one guessed Oklahoma City Thunder — pool rolls over.",
    winnerIds: [],
    poolAtSettlement: 50,
    payoutPerWinner: 0,
  },
  {
    id: "topic-3",
    order: 3,
    title: "2025 Wimbledon Men's Singles",
    description: "Who will win the 2025 Wimbledon Men's Singles title?",
    status: "settled",
    openAt:    "2025-06-26T00:00:00Z",
    closeAt:   "2025-07-13T12:00:00Z",
    settledAt: "2025-07-13T18:00:00Z",
    resolutionNote: "Carlos Alcaraz won. Players 1 and 4 predicted correctly — pool split.",
    winnerIds: ["player-1", "player-4"],
    poolAtSettlement: 100,
    payoutPerWinner: 50,
  },
  {
    id: "topic-4",
    order: 4,
    title: "Next Apple iPhone Launch",
    description: "What will Apple name their next flagship iPhone released in fall 2025?",
    status: "closed",
    openAt:  "2025-07-14T00:00:00Z",
    closeAt: "2025-09-08T16:00:00Z",
  },
  {
    id: "topic-5",
    order: 5,
    title: "2026 FIFA World Cup Host MVP",
    description: "Who will win the Golden Ball at the 2026 FIFA World Cup?",
    status: "open",
    openAt:  "2025-09-09T00:00:00Z",
    closeAt: "2026-07-19T18:00:00Z",
  },
  {
    id: "topic-6",
    order: 6,
    title: "First AI to pass bar exam universally",
    description: "Which AI system will be the first to be officially recognized as passing the bar exam in a US state?",
    status: "draft",
    openAt:  "2026-07-20T00:00:00Z",
    closeAt: "2027-01-01T00:00:00Z",
  },
];

export const PREDICTIONS: Prediction[] = [
  // Topic 1 - Super Bowl
  { id: "p1-1", topicId: "topic-1", playerId: "player-1", text: "Kansas City Chiefs",       createdAt: "2025-01-15T10:00:00Z", updatedAt: "2025-01-15T10:00:00Z", isWinner: false },
  { id: "p1-2", topicId: "topic-1", playerId: "player-2", text: "Philadelphia Eagles",      createdAt: "2025-01-20T14:30:00Z", updatedAt: "2025-02-01T09:00:00Z", isWinner: false },
  { id: "p1-3", topicId: "topic-1", playerId: "player-3", text: "Philadelphia Eagles",      createdAt: "2025-01-22T11:00:00Z", updatedAt: "2025-01-22T11:00:00Z", isWinner: true  },
  { id: "p1-4", topicId: "topic-1", playerId: "player-4", text: "Kansas City Chiefs",       createdAt: "2025-01-18T16:45:00Z", updatedAt: "2025-01-18T16:45:00Z", isWinner: false },
  { id: "p1-5", topicId: "topic-1", playerId: "player-5", text: "San Francisco 49ers",      createdAt: "2025-01-25T08:20:00Z", updatedAt: "2025-01-25T08:20:00Z", isWinner: false },

  // Topic 2 - NBA
  { id: "p2-1", topicId: "topic-2", playerId: "player-1", text: "Boston Celtics",           createdAt: "2025-02-12T09:00:00Z", updatedAt: "2025-02-12T09:00:00Z", isWinner: false },
  { id: "p2-2", topicId: "topic-2", playerId: "player-2", text: "Golden State Warriors",    createdAt: "2025-02-14T11:30:00Z", updatedAt: "2025-02-14T11:30:00Z", isWinner: false },
  { id: "p2-3", topicId: "topic-2", playerId: "player-3", text: "Boston Celtics",           createdAt: "2025-02-15T14:00:00Z", updatedAt: "2025-02-15T14:00:00Z", isWinner: false },
  { id: "p2-4", topicId: "topic-2", playerId: "player-4", text: "Denver Nuggets",           createdAt: "2025-02-16T10:15:00Z", updatedAt: "2025-02-16T10:15:00Z", isWinner: false },
  { id: "p2-5", topicId: "topic-2", playerId: "player-5", text: "Cleveland Cavaliers",      createdAt: "2025-02-18T16:00:00Z", updatedAt: "2025-02-18T16:00:00Z", isWinner: false },

  // Topic 3 - Wimbledon
  { id: "p3-1", topicId: "topic-3", playerId: "player-1", text: "Carlos Alcaraz",           createdAt: "2025-06-28T09:00:00Z", updatedAt: "2025-06-28T09:00:00Z", isWinner: true  },
  { id: "p3-2", topicId: "topic-3", playerId: "player-2", text: "Novak Djokovic",           createdAt: "2025-06-29T10:00:00Z", updatedAt: "2025-06-29T10:00:00Z", isWinner: false },
  { id: "p3-3", topicId: "topic-3", playerId: "player-3", text: "Jannik Sinner",            createdAt: "2025-07-01T08:30:00Z", updatedAt: "2025-07-01T08:30:00Z", isWinner: false },
  { id: "p3-4", topicId: "topic-3", playerId: "player-4", text: "Carlos Alcaraz",           createdAt: "2025-07-02T15:20:00Z", updatedAt: "2025-07-02T15:20:00Z", isWinner: true  },
  { id: "p3-5", topicId: "topic-3", playerId: "player-5", text: "Rafael Nadal",             createdAt: "2025-07-03T11:00:00Z", updatedAt: "2025-07-03T11:00:00Z", isWinner: false },

  // Topic 4 - iPhone (closed, predictions locked)
  { id: "p4-1", topicId: "topic-4", playerId: "player-1", text: "iPhone 17 Pro",            createdAt: "2025-07-20T09:00:00Z", updatedAt: "2025-07-20T09:00:00Z" },
  { id: "p4-2", topicId: "topic-4", playerId: "player-2", text: "iPhone 17 Ultra",          createdAt: "2025-07-25T14:00:00Z", updatedAt: "2025-08-10T09:00:00Z" },
  { id: "p4-3", topicId: "topic-4", playerId: "player-3", text: "iPhone 17 Air",            createdAt: "2025-07-28T16:30:00Z", updatedAt: "2025-07-28T16:30:00Z" },
  { id: "p4-4", topicId: "topic-4", playerId: "player-4", text: "iPhone 17",                createdAt: "2025-08-01T11:00:00Z", updatedAt: "2025-08-01T11:00:00Z" },
  // player-5 has not submitted for topic-4

  // Topic 5 - FIFA (open, current user can edit)
  { id: "p5-1", topicId: "topic-5", playerId: "player-1", text: "Kylian Mbappé",            createdAt: "2025-09-10T08:00:00Z", updatedAt: "2025-09-10T08:00:00Z" },
  { id: "p5-3", topicId: "topic-5", playerId: "player-3", text: "Erling Haaland",           createdAt: "2025-09-12T10:30:00Z", updatedAt: "2025-09-12T10:30:00Z" },
  // player-2 (current user) hasn't submitted yet
  // player-4, player-5 haven't submitted yet
];

// Compute rolling pool from settled topics
export function computePool(): { rolledOver: number; topicCount: number } {
  let rolledOver = 0;
  let topicCount = 0;
  for (const topic of TOPICS) {
    if (topic.status === "settled") {
      if (!topic.winnerIds || topic.winnerIds.length === 0) {
        rolledOver += topic.poolAtSettlement ?? 0;
        topicCount++;
      } else {
        rolledOver = 0;
        topicCount = 0;
      }
    }
  }
  return { rolledOver, topicCount };
}

export function getActivePool(league: League): PoolState {
  const activeTopic =
    TOPICS.find((t) => t.status === "open") ??
    TOPICS.find((t) => t.status === "closed");
  const { rolledOver } = computePool();
  const contribution = league.stakePerTopic * league.playerIds.length;
  return {
    currentTopicId: activeTopic?.id ?? "",
    accumulatedPool: rolledOver,
    topicContribution: contribution,
    totalPool: rolledOver + contribution,
  };
}

export function getPlayerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}

export function getPredictionsForTopic(topicId: string): Prediction[] {
  return PREDICTIONS.filter((p) => p.topicId === topicId);
}

export function getUserPrediction(topicId: string, playerId: string): Prediction | undefined {
  return PREDICTIONS.find((p) => p.topicId === topicId && p.playerId === playerId);
}

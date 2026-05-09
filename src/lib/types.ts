export type Role = "admin" | "player";

export interface Player {
  id: string;
  name: string;
  avatarInitials: string;
  role: Role;
}

export type TopicStatus = "draft" | "upcoming" | "open" | "closed" | "settled";

export interface Topic {
  id: string;
  order: number;
  title: string;
  description: string;
  status: TopicStatus;
  openAt: string;   // ISO date string
  closeAt: string;  // ISO date string
  settledAt?: string;
  resolutionNote?: string;
  winnerIds?: string[];
  poolAtSettlement?: number;
  payoutPerWinner?: number;
}

export interface Prediction {
  id: string;
  topicId: string;
  playerId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  isWinner?: boolean;
}

export interface League {
  id: string;
  name: string;
  stakePerTopic: number;
  currency: string;
  playerIds: string[];
}

export interface PoolState {
  currentTopicId: string;
  accumulatedPool: number;
  topicContribution: number;
  totalPool: number;
}

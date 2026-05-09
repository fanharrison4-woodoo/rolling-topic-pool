export interface SettlementComputationInput {
  carryoverAmount: number;
  stakeAmount: number;
  playerCount: number;
  winnerCount: number;
}

export interface SettlementComputationResult {
  contributionAmount: number;
  totalPoolAmount: number;
  payoutPerWinner: number;
  nextCarryoverAmount: number;
}

export function computeSettlement({
  carryoverAmount,
  stakeAmount,
  playerCount,
  winnerCount,
}: SettlementComputationInput): SettlementComputationResult {
  if (stakeAmount < 0 || playerCount < 0 || carryoverAmount < 0 || winnerCount < 0) {
    throw new Error("Settlement inputs must be non-negative");
  }

  const contributionAmount = stakeAmount * playerCount;
  const totalPoolAmount = carryoverAmount + contributionAmount;

  if (winnerCount === 0) {
    return {
      contributionAmount,
      totalPoolAmount,
      payoutPerWinner: 0,
      nextCarryoverAmount: totalPoolAmount,
    };
  }

  return {
    contributionAmount,
    totalPoolAmount,
    payoutPerWinner: totalPoolAmount / winnerCount,
    nextCarryoverAmount: 0,
  };
}

export function canRevealPredictionsToPlayers(status: "draft" | "open" | "closed" | "settled") {
  return status === "closed" || status === "settled";
}

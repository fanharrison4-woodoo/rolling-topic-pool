import { describe, expect, it } from "vitest";
import { canRevealPredictionsToPlayers, computeSettlement } from "./settlement-rules";

describe("settlement-rules", () => {
  it("rolls the pool forward when there are no winners", () => {
    expect(
      computeSettlement({
        carryoverAmount: 50,
        stakeAmount: 5,
        playerCount: 4,
        winnerCount: 0,
      }),
    ).toEqual({
      contributionAmount: 20,
      totalPoolAmount: 70,
      payoutPerWinner: 0,
      nextCarryoverAmount: 70,
    });
  });

  it("splits the total pool evenly when there are winners", () => {
    expect(
      computeSettlement({
        carryoverAmount: 30,
        stakeAmount: 5,
        playerCount: 6,
        winnerCount: 3,
      }),
    ).toEqual({
      contributionAmount: 30,
      totalPoolAmount: 60,
      payoutPerWinner: 20,
      nextCarryoverAmount: 0,
    });
  });

  it("reveals predictions only after a topic closes", () => {
    expect(canRevealPredictionsToPlayers("draft")).toBe(false);
    expect(canRevealPredictionsToPlayers("open")).toBe(false);
    expect(canRevealPredictionsToPlayers("closed")).toBe(true);
    expect(canRevealPredictionsToPlayers("settled")).toBe(true);
  });
});

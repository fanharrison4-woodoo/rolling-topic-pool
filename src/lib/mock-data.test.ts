import { describe, expect, it } from "vitest";
import { LEAGUE, computePool, getActivePool, getPredictionsForTopic, getUserPrediction } from "./mock-data";

describe("mock-data pool helpers", () => {
  it("computes the rolled-over pool from settled topics", () => {
    expect(computePool()).toEqual({ rolledOver: 0, topicCount: 0 });
  });

  it("computes the active pool for the open topic", () => {
    expect(getActivePool(LEAGUE)).toEqual({
      currentTopicId: "topic-5",
      accumulatedPool: 0,
      topicContribution: 25,
      totalPool: 25,
    });
  });

  it("loads per-topic predictions and a single user's prediction", () => {
    expect(getPredictionsForTopic("topic-5")).toHaveLength(2);
    expect(getUserPrediction("topic-4", "player-2")?.text).toBe("iPhone 17 Ultra");
    expect(getUserPrediction("topic-5", "player-2")).toBeUndefined();
  });
});

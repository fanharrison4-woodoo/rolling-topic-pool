import { describe, expect, it } from "vitest";
import {
  canLeagueAdminEditTopic,
  canPlayerSubmitPrediction,
  canPlayersViewAllPredictions,
  validateTopicCloseTimesByOrder,
} from "./topic-rules";

describe("topic-rules", () => {
  it("only allows league admins to edit draft topics", () => {
    expect(canLeagueAdminEditTopic("draft")).toBe(true);
    expect(canLeagueAdminEditTopic("open")).toBe(false);
    expect(canLeagueAdminEditTopic("closed")).toBe(false);
    expect(canLeagueAdminEditTopic("settled")).toBe(false);
  });

  it("only allows player submissions while a topic is open", () => {
    expect(canPlayerSubmitPrediction("draft")).toBe(false);
    expect(canPlayerSubmitPrediction("open")).toBe(true);
    expect(canPlayerSubmitPrediction("closed")).toBe(false);
    expect(canPlayerSubmitPrediction("settled")).toBe(false);
  });

  it("reveals all predictions only after a topic closes", () => {
    expect(canPlayersViewAllPredictions("draft")).toBe(false);
    expect(canPlayersViewAllPredictions("open")).toBe(false);
    expect(canPlayersViewAllPredictions("closed")).toBe(true);
    expect(canPlayersViewAllPredictions("settled")).toBe(true);
  });

  it("allows equal close times for ordered topics", () => {
    expect(
      validateTopicCloseTimesByOrder([
        { order: 1, closeAt: "2026-07-19T18:00:00Z" },
        { order: 2, closeAt: "2026-07-19T18:00:00Z" },
        { order: 3, closeAt: "2026-07-19T20:00:00Z" },
      ]),
    ).toEqual({ valid: true });
  });

  it("rejects later topics that close before earlier topics", () => {
    expect(
      validateTopicCloseTimesByOrder([
        { order: 1, closeAt: "2026-07-19T20:00:00Z" },
        { order: 2, closeAt: "2026-07-19T18:00:00Z" },
      ]),
    ).toEqual({
      valid: false,
      firstInvalidPair: {
        previousOrder: 1,
        previousCloseAt: "2026-07-19T20:00:00Z",
        currentOrder: 2,
        currentCloseAt: "2026-07-19T18:00:00Z",
      },
    });
  });
});

import type { TopicStatus } from "./types";

export function canLeagueAdminEditTopic(status: TopicStatus | "draft") {
  return status === "draft";
}

export function canPlayerSubmitPrediction(status: TopicStatus | "draft") {
  return status === "open";
}

export function canPlayersViewAllPredictions(status: TopicStatus | "draft") {
  return status === "closed" || status === "settled";
}

export interface OrderedTopicCloseTime {
  order: number;
  closeAt: string;
}

export interface TopicOrderValidationResult {
  valid: boolean;
  firstInvalidPair?: {
    previousOrder: number;
    previousCloseAt: string;
    currentOrder: number;
    currentCloseAt: string;
  };
}

export function validateTopicCloseTimesByOrder(
  topics: OrderedTopicCloseTime[],
): TopicOrderValidationResult {
  const orderedTopics = [...topics].sort((a, b) => a.order - b.order);

  for (let index = 1; index < orderedTopics.length; index += 1) {
    const previous = orderedTopics[index - 1];
    const current = orderedTopics[index];

    const previousTime = new Date(previous.closeAt).getTime();
    const currentTime = new Date(current.closeAt).getTime();

    if (Number.isNaN(previousTime) || Number.isNaN(currentTime)) {
      throw new Error("closeAt must be a valid ISO date string");
    }

    if (currentTime < previousTime) {
      return {
        valid: false,
        firstInvalidPair: {
          previousOrder: previous.order,
          previousCloseAt: previous.closeAt,
          currentOrder: current.order,
          currentCloseAt: current.closeAt,
        },
      };
    }
  }

  return { valid: true };
}

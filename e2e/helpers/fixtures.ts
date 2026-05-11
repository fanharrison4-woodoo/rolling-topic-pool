import { test as base } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_DIR = path.join(__dirname, "../.auth");

export function authFile(user: string) {
  return path.join(AUTH_DIR, `${user}.json`);
}

export function getTestIds(): { circleId: string; openTopicId: string } {
  const raw = fs.readFileSync(path.join(AUTH_DIR, "test-ids.json"), "utf-8");
  return JSON.parse(raw);
}

export const test = base;
export { expect } from "@playwright/test";

import { jest } from "@jest/globals";

import { getLogger } from "../src/infrastructure/logging/logger.js";

export function captureLogs() {
  const calls: unknown[][] = [];

  for (const level of ["debug", "info", "warn", "error"] as const) {
    jest.spyOn(getLogger(), level).mockImplementation((...args: unknown[]) => { calls.push(args); });
  }

  return { calls };
}

import { describe, expect, it, vi } from "vitest";
import type { HistoryEntry, IHistoryProvider } from "../../providers/history.js";
import { getResponseHistoryHandler } from "./handler.js";

const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 1,
  timestamp: "2024-01-15T14:32:01.000Z",
  method: "GET",
  url: "https://api.example.com/users/1",
  status: 200,
  durationMs: 45,
  ...overrides,
});

const makeProvider = (entries: HistoryEntry[]): IHistoryProvider => ({
  push: vi.fn(),
  list: vi.fn().mockReturnValue(entries),
});

describe("getResponseHistoryHandler", () => {
  it("returns a message when no requests have been made", () => {
    const result = getResponseHistoryHandler({ limit: 10 }, makeProvider([]));
    expect(result).toContain("No requests");
  });

  it("shows method, URL, status, and timing for each entry", () => {
    const result = getResponseHistoryHandler(
      { limit: 10 },
      makeProvider([makeEntry({ method: "POST", status: 201, durationMs: 89 })]),
    );

    expect(result).toContain("POST");
    expect(result).toContain("201");
    expect(result).toContain("89ms");
  });

  it("truncates long URLs to keep the table readable", () => {
    const longUrl = `https://api.example.com/${"a".repeat(100)}`;
    const result = getResponseHistoryHandler(
      { limit: 10 },
      makeProvider([makeEntry({ url: longUrl })]),
    );
    expect(result).toContain("…");
  });

  it("passes the limit to the history provider", () => {
    const provider = makeProvider([]);
    getResponseHistoryHandler({ limit: 5 }, provider);
    expect(provider.list).toHaveBeenCalledWith(5);
  });
});

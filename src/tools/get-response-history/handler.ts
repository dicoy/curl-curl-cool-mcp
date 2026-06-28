import type { IHistoryProvider } from "../../providers/history.js";
import type { Input } from "./schema.js";

export function getResponseHistoryHandler(input: Input, historyProvider: IHistoryProvider): string {
  const entries = historyProvider.list(input.limit);

  if (entries.length === 0) {
    return "No requests made yet in this session.";
  }

  const header = `Recent requests (${entries.length}):`;

  const idWidth = String(entries.length).length;
  const methodWidth = Math.max(...entries.map((e) => e.method.length));
  const urlWidth = Math.min(60, Math.max(...entries.map((e) => e.url.length)));

  const rows = entries.map((e) => {
    const ts = new Date(e.timestamp).toISOString().replace("T", " ").slice(0, 19);
    const url = e.url.length > urlWidth ? `${e.url.slice(0, urlWidth - 1)}…` : e.url;
    return `${String(e.id).padStart(idWidth)}  ${ts}  ${e.method.padEnd(methodWidth)}  ${url.padEnd(urlWidth)}  ${e.status}  ${e.durationMs}ms`;
  });

  return `${header}\n\n${rows.join("\n")}`;
}

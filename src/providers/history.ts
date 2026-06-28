const MAX_ENTRIES = 20;

export interface HistoryEntry {
  id: number;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  responseBody: string;
}

export interface IHistoryProvider {
  push(entry: Omit<HistoryEntry, "id">): void;
  list(limit?: number): HistoryEntry[];
  clear(): void;
}

export class InMemoryHistoryProvider implements IHistoryProvider {
  private entries: HistoryEntry[] = [];
  private nextId = 1;

  push(entry: Omit<HistoryEntry, "id">): void {
    this.entries.unshift({ ...entry, id: this.nextId++ });
    if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES;
  }

  list(limit = 10): HistoryEntry[] {
    return this.entries.slice(0, Math.min(limit, MAX_ENTRIES));
  }

  clear(): void {
    this.entries = [];
    this.nextId = 1;
  }
}

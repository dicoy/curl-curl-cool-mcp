import { readFile } from "node:fs/promises";
import { CollectionNotFoundError, CollectionParseError } from "../errors/index.js";

export interface PostmanVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface PostmanEnvironmentData {
  name: string;
  variables: PostmanVariable[];
}

export interface IPostmanEnvironmentProvider {
  load(filePath: string): Promise<PostmanEnvironmentData>;
}

export class FsPostmanEnvironmentProvider implements IPostmanEnvironmentProvider {
  async load(filePath: string): Promise<PostmanEnvironmentData> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      throw new CollectionNotFoundError(filePath);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new CollectionParseError(filePath, err instanceof Error ? err.message : String(err));
    }

    if (typeof parsed !== "object" || parsed === null || !("values" in parsed)) {
      throw new CollectionParseError(
        filePath,
        "not a valid Postman environment file (missing 'values' array)",
      );
    }

    const env = parsed as { name?: string; values?: unknown[] };

    const variables: PostmanVariable[] = (env.values ?? []).flatMap((v) => {
      if (typeof v !== "object" || v === null) return [];
      const entry = v as { key?: unknown; value?: unknown; enabled?: unknown };
      if (typeof entry.key !== "string" || !entry.key) return [];
      return [
        {
          key: entry.key,
          value: String(entry.value ?? ""),
          enabled: entry.enabled !== false,
        },
      ];
    });

    return { name: env.name ?? "Postman Environment", variables };
  }
}

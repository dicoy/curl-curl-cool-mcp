import type { HttpResponse, IHttpProvider } from "../../providers/http.js";
import { resolveAuthHeaders } from "../../utils/auth.js";
import { substituteVariables } from "../../utils/variables.js";
import type { Input } from "./schema.js";

interface EnvResult {
  name: string;
  url: string;
  response: HttpResponse | Error;
}

export async function diffEnvironmentsHandler(
  input: Input,
  httpProvider: IHttpProvider,
): Promise<string> {
  const envEntries = Object.entries(input.environments);
  if (envEntries.length < 2) {
    return "Error: at least two environments are required to diff.";
  }

  const results: EnvResult[] = await Promise.all(
    envEntries.map(async ([name, baseUrlOrVars]) => {
      const url =
        typeof baseUrlOrVars === "string"
          ? `${baseUrlOrVars.replace(/\/$/, "")}${input.path}`
          : substituteVariables(input.path, baseUrlOrVars);
      try {
        const authHeaders = resolveAuthHeaders(input.auth);
        const mergedHeaders = { ...authHeaders, ...(input.headers ?? {}) };
        const response = await httpProvider.request({
          method: input.method,
          url,
          ...(Object.keys(mergedHeaders).length > 0 && { headers: mergedHeaders }),
          ...(input.body !== undefined && { body: input.body }),
          timeoutMs: input.timeout_ms,
        });
        return { name, url, response };
      } catch (err) {
        return { name, url, response: err instanceof Error ? err : new Error(String(err)) };
      }
    }),
  );

  return formatDiff(input.method, input.path, results);
}

function formatDiff(method: string, path: string, results: EnvResult[]): string {
  const header = `${method} ${path}\n`;

  const tableHeader = "Environment     Status  Time     Size";
  const tableSep = "─────────────── ─────── ──────── ──────";
  const tableRows = results.map(({ name, response }) => {
    if (response instanceof Error) {
      return `${name.padEnd(15)}  ERROR   —        —  (${response.message})`;
    }
    const size =
      response.body.length < 1024
        ? `${response.body.length} B`
        : `${(response.body.length / 1024).toFixed(1)} KB`;
    return `${name.padEnd(15)}  ${String(response.status).padEnd(5)}   ${`${response.durationMs}ms`.padEnd(7)}  ${size}`;
  });
  const table = [tableHeader, tableSep, ...tableRows].join("\n");

  const diffs = buildDiffs(results);

  return [header, table, diffs].filter(Boolean).join("\n\n");
}

type SuccessfulEnvResult = EnvResult & { response: HttpResponse };

function buildDiffs(results: EnvResult[]): string {
  const successful = results.filter(
    (r): r is SuccessfulEnvResult => !(r.response instanceof Error),
  );
  if (successful.length < 2) return "";
  const base = successful[0];
  if (!base) return "";

  return successful
    .slice(1)
    .flatMap((other) => compareEnvs(base, other))
    .join("\n");
}

function compareEnvs(base: SuccessfulEnvResult, other: SuccessfulEnvResult): string[] {
  const label = `${base.name} vs ${other.name}`;
  const statusSame = base.response.status === other.response.status;
  const bodyDiffs = diffJson(base.response.body, other.response.body);

  if (statusSame && bodyDiffs.length === 0) return [`${label} — identical responses`];

  const lines: string[] = [];
  if (!statusSame) {
    lines.push(`${label} — status: ${base.response.status} vs ${other.response.status}`);
  }
  if (bodyDiffs.length > 0) {
    lines.push(`${label} — body differences:`);
    for (const d of bodyDiffs) lines.push(`  ${d}`);
  }
  return lines;
}

function diffJson(a: string, b: string): string[] {
  let pa: unknown;
  let pb: unknown;
  try {
    pa = JSON.parse(a);
  } catch {
    pa = a;
  }
  try {
    pb = JSON.parse(b);
  } catch {
    pb = b;
  }
  return diffValues(pa, pb, "");
}

function diffValues(a: unknown, b: unknown, path: string): string[] {
  if (a === b) return [];
  const label = path || "root";
  if (a === null || b === null || typeof a !== typeof b) {
    return [`${label}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
  }
  if (typeof a !== "object") return [`${label}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
  if (Array.isArray(a) !== Array.isArray(b)) {
    return [`${label}: type mismatch (array vs object)`];
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return diffArrayElements(a, b, label);
  }
  return diffObjects(a as Record<string, unknown>, b as Record<string, unknown>, path);
}

function diffArrayElements(a: unknown[], b: unknown[], label: string): string[] {
  const diffs: string[] = [];
  if (a.length !== b.length) diffs.push(`${label}[]: length ${a.length} → ${b.length}`);
  const limit = Math.min(a.length, b.length, 5);
  for (let i = 0; i < limit; i++) {
    diffs.push(...diffValues(a[i], b[i], `${label}[${i}]`));
  }
  return diffs;
}

function diffObjects(
  ao: Record<string, unknown>,
  bo: Record<string, unknown>,
  path: string,
): string[] {
  const diffs: string[] = [];
  const allKeys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const key of allKeys) {
    const keyPath = path ? `${path}.${key}` : key;
    if (!(key in ao)) {
      diffs.push(`+ ${keyPath} (added)`);
      continue;
    }
    if (!(key in bo)) {
      diffs.push(`- ${keyPath} (removed)`);
      continue;
    }
    diffs.push(...diffValues(ao[key], bo[key], keyPath));
  }
  return diffs;
}

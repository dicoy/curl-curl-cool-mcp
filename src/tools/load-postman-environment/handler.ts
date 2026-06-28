import type {
  IPostmanEnvironmentProvider,
  PostmanEnvironmentData,
  PostmanVariable,
} from "../../providers/postman-environment.js";
import type { Input } from "./schema.js";

const SECRET_PATTERNS = [
  /secret/i,
  /password/i,
  /passwd/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /private/i,
];

function isSecret(key: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(key));
}

export async function loadPostmanEnvironmentHandler(
  input: Input,
  provider: IPostmanEnvironmentProvider,
): Promise<string> {
  const env = await provider.load(input.path);
  return formatEnvironment(input.path, env);
}

function formatEnvironment(filePath: string, env: PostmanEnvironmentData): string {
  const active = env.variables.filter((v) => v.enabled);
  const disabledCount = env.variables.length - active.length;

  const countNote = disabledCount > 0 ? `, ${disabledCount} disabled` : "";
  const header = [
    `File: ${filePath}`,
    `Environment: ${env.name}`,
    `Variables: ${active.length} active${countNote}`,
  ].join("\n");

  if (active.length === 0) return `${header}\n\nNo active variables.`;

  const rows = formatRows(active);
  const hint =
    "Substitute {{variable}} placeholders in collection URLs, then pass the resolved URL to http_request.";

  return `${header}\n\n${rows}\n\n${hint}`;
}

function formatRows(variables: PostmanVariable[]): string {
  const keyWidth = Math.max(...variables.map((v) => v.key.length));
  return variables
    .map((v) => {
      const label = `{{${v.key}}}`.padEnd(keyWidth + 4);
      const value = isSecret(v.key) ? "••••••••" : v.value || "(empty)";
      return `${label}  ${value}`;
    })
    .join("\n");
}

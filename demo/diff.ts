import { HttpClientError } from "../src/errors/index.js";
import { NodeFetchProvider } from "../src/providers/http.js";
import { diffEnvironmentsHandler } from "../src/tools/diff-environments/handler.js";

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:  (s: string) => `\x1b[2m${s}\x1b[0m`,
  red:  (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

async function section(label: string, fn: () => Promise<string>): Promise<void> {
  const fill = Math.max(2, 54 - label.length);
  console.log(`\n${c.cyan(c.bold("━━"))}  ${c.bold(label)}  ${c.dim("━".repeat(fill))}`);
  try {
    console.log(`\n${await fn()}`);
  } catch (err) {
    if (err instanceof HttpClientError) {
      console.log(`\n${c.red("✗")}  ${c.bold(err.name)}: ${err.message}`);
    } else throw err;
  }
}

const http = new NodeFetchProvider();

console.log();
console.log(c.bold("╔══════════════════════════════════════════════════════════╗"));
console.log(c.bold("║") + "   mcp-httpclient  ·  what Claude sees from tool calls    " + c.bold("║"));
console.log(c.bold("╚══════════════════════════════════════════════════════════╝"));

await section("diff_environments · dev vs staging via {{variable}} maps", () =>
  diffEnvironmentsHandler(
    {
      method: "GET",
      path: "{{api}}/users/{{id}}",
      environments: {
        dev:     { api: "https://jsonplaceholder.typicode.com", id: "1" },
        staging: { api: "https://jsonplaceholder.typicode.com", id: "2" },
      },
      timeout_ms: 10000,
    },
    http,
  ),
);

console.log(`\n${c.dim("─".repeat(60))}`);
console.log(c.dim("Each environment resolves its own {{variables}} before the request fires."));
console.log(c.dim("Requests run in parallel — diffs are field-level, not line-level."));
console.log();

import { HttpClientError } from "../src/errors/index.js";
import { InMemoryHistoryProvider } from "../src/providers/history.js";
import { NodeFetchProvider } from "../src/providers/http.js";
import { httpRequestHandler } from "../src/tools/http-request/handler.js";

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

const http    = new NodeFetchProvider();
const history = new InMemoryHistoryProvider();

console.log();
console.log(c.bold("╔══════════════════════════════════════════════════════════╗"));
console.log(c.bold("║") + "   mcp-httpclient  ·  what Claude sees from tool calls    " + c.bold("║"));
console.log(c.bold("╚══════════════════════════════════════════════════════════╝"));

await section("http_request · GET /users/1", () =>
  httpRequestHandler(
    { method: "GET", url: "https://jsonplaceholder.typicode.com/users/1", timeout_ms: 10000 },
    http,
    history,
  ),
);

console.log(`\n${c.dim("─".repeat(60))}`);
console.log(c.dim("Status · timing · filtered headers · pretty-printed JSON body."));
console.log();

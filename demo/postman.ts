import { HttpClientError } from "../src/errors/index.js";
import { FsCollectionProvider } from "../src/providers/collection.js";
import { FsPostmanEnvironmentProvider } from "../src/providers/postman-environment.js";
import { loadCollectionHandler } from "../src/tools/load-collection/handler.js";
import { loadPostmanEnvironmentHandler } from "../src/tools/load-postman-environment/handler.js";

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

const collection = new FsCollectionProvider();
const environment = new FsPostmanEnvironmentProvider();

console.log();
console.log(c.bold("╔══════════════════════════════════════════════════════════╗"));
console.log(c.bold("║") + "   mcp-httpclient  ·  what Claude sees from tool calls    " + c.bold("║"));
console.log(c.bold("╚══════════════════════════════════════════════════════════╝"));

await section("load_collection · Postman Collection v2.1", () =>
  loadCollectionHandler(
    { path: "demo/fixtures/api.postman_collection.json" },
    collection,
  ),
);

await section("load_postman_environment · Development", () =>
  loadPostmanEnvironmentHandler(
    { path: "demo/fixtures/dev.postman_environment.json" },
    environment,
  ),
);

console.log(`\n${c.dim("─".repeat(60))}`);
console.log(c.dim("Claude resolves {{variables}} from the environment into collection URLs,"));
console.log(c.dim("then calls http_request or diff_environments with the result."));
console.log();

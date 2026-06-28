import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FsCollectionProvider } from "./providers/collection.js";
import { InMemoryHistoryProvider } from "./providers/history.js";
import { NodeFetchProvider } from "./providers/http.js";
import { type Providers, registerTools } from "./registry/tool-registry.js";

export function createServer(): McpServer {
  const providers: Providers = {
    http: new NodeFetchProvider(),
    history: new InMemoryHistoryProvider(),
    collection: new FsCollectionProvider(),
  };

  const server = new McpServer({
    name: "mcp-httpclient",
    version: "0.1.0",
  });

  registerTools(server, providers);

  return server;
}

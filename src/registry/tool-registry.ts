import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ICollectionProvider } from "../providers/collection.js";
import type { IHistoryProvider } from "../providers/history.js";
import type { IHttpProvider } from "../providers/http.js";
import type { IPostmanEnvironmentProvider } from "../providers/postman-environment.js";
import { diffEnvironmentsHandler } from "../tools/diff-environments/handler.js";
import { InputSchema as DiffEnvironmentsSchema } from "../tools/diff-environments/schema.js";
import { generateTypesHandler } from "../tools/generate-types/handler.js";
import { InputSchema as GenerateTypesSchema } from "../tools/generate-types/schema.js";
import { getResponseHistoryHandler } from "../tools/get-response-history/handler.js";
import { InputSchema as GetResponseHistorySchema } from "../tools/get-response-history/schema.js";
import { httpRequestHandler } from "../tools/http-request/handler.js";
import { InputSchema as HttpRequestSchema } from "../tools/http-request/schema.js";
import { loadCollectionHandler } from "../tools/load-collection/handler.js";
import { InputSchema as LoadCollectionSchema } from "../tools/load-collection/schema.js";
import { loadPostmanEnvironmentHandler } from "../tools/load-postman-environment/handler.js";
import { InputSchema as LoadPostmanEnvironmentSchema } from "../tools/load-postman-environment/schema.js";

export interface Providers {
  http: IHttpProvider;
  history: IHistoryProvider;
  collection: ICollectionProvider;
  postmanEnvironment: IPostmanEnvironmentProvider;
}

export function registerTools(server: McpServer, providers: Providers): void {
  server.tool(
    "http_request",
    "Make an HTTP request (GET/POST/PUT/PATCH/DELETE/HEAD) and return the status, headers, and body. Responses are pretty-printed when JSON.",
    HttpRequestSchema.shape,
    async (input) => ({
      content: [
        {
          type: "text",
          text: await httpRequestHandler(input, providers.http, providers.history),
        },
      ],
    }),
  );

  server.tool(
    "diff_environments",
    "Make the same HTTP request against multiple environments in parallel and show what differs in status codes and response bodies.",
    DiffEnvironmentsSchema.shape,
    async (input) => ({
      content: [{ type: "text", text: await diffEnvironmentsHandler(input, providers.http) }],
    }),
  );

  server.tool(
    "generate_types",
    "Infer TypeScript interface declarations from a JSON string. Nest objects become named interfaces. Chain with http_request to generate types from a live API response.",
    GenerateTypesSchema.shape,
    (input) => ({
      content: [{ type: "text", text: generateTypesHandler(input) }],
    }),
  );

  server.tool(
    "load_collection",
    "Parse an OpenAPI 3.0 spec, Postman Collection v2.1, or custom JSON collection and list all available endpoints.",
    LoadCollectionSchema.shape,
    async (input) => ({
      content: [{ type: "text", text: await loadCollectionHandler(input, providers.collection) }],
    }),
  );

  server.tool(
    "load_postman_environment",
    "Load a Postman environment file and list its variables. Use the values to substitute {{placeholders}} in collection URLs before calling http_request.",
    LoadPostmanEnvironmentSchema.shape,
    async (input) => ({
      content: [
        {
          type: "text",
          text: await loadPostmanEnvironmentHandler(input, providers.postmanEnvironment),
        },
      ],
    }),
  );

  server.tool(
    "get_response_history",
    "List recent HTTP requests made in this session with their status and timing. History is in-memory and resets when the server restarts.",
    GetResponseHistorySchema.shape,
    (input) => ({
      content: [{ type: "text", text: getResponseHistoryHandler(input, providers.history) }],
    }),
  );
}

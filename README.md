# mcp-httpclient

An MCP server that gives Claude a full HTTP client — make requests, compare environments, infer TypeScript types from live responses, and work directly with your existing Postman collections and environments.

Built with the [Model Context Protocol](https://modelcontextprotocol.io/) TypeScript SDK, native `fetch` (no Axios), and a provider pattern that keeps every tool unit-testable without network calls.

---

## Tools

| Tool | Description |
|---|---|
| `http_request` | Make an HTTP request and return status, headers, and body. JSON responses are pretty-printed. Supports auth, custom headers, body, and `{{variable}}` substitution. |
| `diff_environments` | Fire the same request against multiple environments in parallel and show what differs in status codes and response bodies — field by field. |
| `generate_types` | Infer TypeScript interface declarations from a JSON string. Nested objects become named interfaces. Chain after `http_request` to generate types from a live API response. |
| `load_collection` | Parse an OpenAPI 3.0 spec or Postman Collection v2.1 and list all endpoints. Shows pre-defined headers, body, and collection variables. |
| `load_postman_environment` | Load a Postman environment file and list its variables, masking secrets. Use the values to resolve `{{placeholders}}` in collection URLs. |
| `get_response_history` | List recent requests made in this session with status and timing. Resets when the server restarts. |

![http_request demo](https://raw.githubusercontent.com/dicoy/curl-curl-cool-mcp/main/demo/http.gif)

---

## Works with Postman

> **This is where it gets interesting.** If you configure this server alongside [Postman's official MCP server](https://github.com/postmanlabs/postman-mcp-server), Claude becomes the orchestrator between them — browsing your Postman workspace with one server and executing requests with this one.

### Why this matters

Postman's MCP server gives Claude access to your workspace: it can list collections, read request definitions, and fetch environment values directly from the Postman API. But it doesn't execute requests.

This server is the execution layer. Together, they let Claude go from "find the endpoint" to "run it, diff it across environments, and generate TypeScript types for the response" in a single conversation — without you copy-pasting a single URL.

### Setup

Add both servers to your Claude config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "httpclient": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-httpclient/dist/index.js"]
    },
    "postman": {
      "command": "npx",
      "args": ["-y", "@postman/postman-mcp-server"],
      "env": {
        "POSTMAN_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Get your Postman API key from **Postman → Account Settings → API Keys**.  
See [Postman's MCP server docs](https://github.com/postmanlabs/postman-mcp-server) for the full setup guide.

### Example workflows

Once both servers are configured, you can give Claude prompts like these:

**Explore and execute:**
> "Find the Create Order endpoint in my Payments collection on Postman, load the staging environment, and make a test request."

Claude calls Postman MCP to find the endpoint definition, then calls `load_postman_environment` and `http_request` here to execute it.

**Cross-environment diff:**
> "Run the GET /users endpoint from my API collection against dev and prod and tell me what's different."

Claude resolves the base URLs from two environment files and calls `diff_environments`, which fires both requests in parallel and shows field-level diffs.

**Type generation from live data:**
> "Hit the /products endpoint on staging and generate TypeScript types for the response."

Claude chains `http_request` → `generate_types` — no copy-pasting JSON.

![Postman integration demo](https://raw.githubusercontent.com/dicoy/curl-curl-cool-mcp/main/demo/postman.gif)

### Variable substitution

Postman collections use `{{variable}}` placeholders for environment-specific values. Both `http_request` and `diff_environments` resolve these natively, so Claude can pass data from Postman MCP straight through without manual substitution.

**Single request with variables:**
```
http_request({
  url: "{{base_url}}/api/{{version}}/users/{{user_id}}",
  variables: {
    base_url: "https://api.example.com",
    version:  "v2",
    user_id:  "42"
  }
})
```

**Multi-environment diff with per-env variable maps:**
```
diff_environments({
  path: "{{base_url}}/api/users",
  environments: {
    dev:  { base_url: "https://api-dev.example.com" },
    prod: { base_url: "https://api.example.com"     }
  }
})
```

Unresolved placeholders are left intact so Claude can see what's missing rather than silently sending a broken URL.

![diff_environments demo](https://raw.githubusercontent.com/dicoy/curl-curl-cool-mcp/main/demo/diff.gif)

---

## Authentication

`http_request` and `diff_environments` both support three auth mechanisms via the `auth` parameter:

| Type | Parameters | Header produced |
|---|---|---|
| `bearer` | `token` | `Authorization: Bearer <token>` |
| `basic` | `username`, `password` | `Authorization: Basic <base64>` |
| `api-key` | `header` (default: `X-API-Key`), `value` | `<header>: <value>` |

Explicit `headers` always take precedence over `auth`, so you can override if needed.

---

## Installation

```bash
git clone https://github.com/dicoy/curl-curl-cool-mcp.git
cd curl-curl-cool-mcp
npm install
npm run build
```

Then add the server to your Claude config as shown above, pointing `args` at `dist/index.js`.

---

## Architecture

```
src/
├── providers/           # Interfaces + implementations (injectable for tests)
│   ├── http.ts          # IHttpProvider / NodeFetchProvider (native fetch, AbortController)
│   ├── history.ts       # IHistoryProvider / InMemoryHistoryProvider (max 20 entries)
│   ├── collection.ts    # ICollectionProvider / FsCollectionProvider (OpenAPI + Postman)
│   └── postman-environment.ts  # IPostmanEnvironmentProvider / FsPostmanEnvironmentProvider
├── tools/               # One directory per tool: schema.ts + handler.ts + handler.test.ts
├── utils/
│   ├── auth.ts          # resolveAuthHeaders — shared by http_request + diff_environments
│   └── variables.ts     # substituteVariables — {{placeholder}} resolution
└── registry/
    └── tool-registry.ts # Wires providers into MCP tool registrations
```

Each tool handler is a pure function `(input, ...providers) => string`. Providers are injected, so tests mock the interface rather than the network or filesystem. 44 unit tests, zero network calls.

**Tech:** TypeScript 5 (strict + `exactOptionalPropertyTypes`), MCP SDK, Zod, Biome, Vitest, tsup.

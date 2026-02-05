# Sandarb SDK

This directory contains the **unified SDKs** for the Sandarb AI Governance platform. All SDKs implement the same interface (see [UNIFIED_INTERFACE.md](./UNIFIED_INTERFACE.md)):

- **get_context**(context_name, agent_id) → content + context_version_id  
- **get_prompt**(prompt_name, variables?) → compiled prompt text  
- **log_activity**(agent_id, trace_id, inputs, outputs) → writes to sandarb_access_logs  

Authentication is via **API Key** (maps to `service_accounts` in the database).

## Project structure

```
sdk/
├── UNIFIED_INTERFACE.md   # Abstract interface all SDKs implement
├── README.md              # This file
├── python/                # Python SDK (pydantic)
│   ├── pyproject.toml
│   ├── README.md
│   ├── examples/
│   └── sandarb/
│       ├── __init__.py
│       ├── client.py
│       ├── models.py
│       ├── async_client.py
│       ├── decorators.py
│       └── integrations/
├── node/                  # TypeScript/Node SDK (zod)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── client.ts
│       ├── models.ts
│       └── index.ts
├── go/                    # Go SDK (standard structs)
│   ├── go.mod
│   └── sandarb/
│       ├── client.go
│       └── models.go
└── java/                  # Java SDK (Jackson, Java 11+)
    ├── pom.xml
    ├── README.md
    └── src/main/java/ai/sandarb/
        ├── SandarbClient.java
        ├── GetContextResult.java
        ├── GetPromptResult.java
        └── SandarbException.java
```

Additional SDKs (Kotlin, C#/.NET) and REST/OpenAPI specs can be added under `sdk/` following the same interface.

## Build and test

### Prerequisites

- **Python**: 3.10+, pip
- **Node**: 18+, npm
- **Go**: 1.21+
- **Java**: 11+, Maven 3.6+

### Python

```bash
cd sdk/python
pip install -e .
# Or with dev deps: pip install -e ".[dev]"

# Run tests (when added)
pytest
```

### Node (TypeScript)

```bash
cd sdk/node
npm install
npm run build
# Tests: npm test
```

### Go

```bash
cd sdk/go
go mod tidy
go build ./...
# Tests: go test ./...
```

### Java

```bash
cd sdk/java
mvn compile
# Package: mvn package
# Tests: mvn test
```

### All at once (from repo root)

```bash
# Python
pip install -e sdk/python

# Node
(cd sdk/node && npm install && npm run build)

# Go
(cd sdk/go && go mod tidy && go build ./...)

# Java
(cd sdk/java && mvn compile)
```

## Environment variables

All SDKs respect:

| Variable           | Description                          |
|--------------------|--------------------------------------|
| `SANDARB_URL`     | API base URL (default: https://api.sandarb.ai) |
| `SANDARB_API_KEY` | API key for auth (service_accounts)  |
| `SANDARB_AGENT_ID`| Default agent ID for get_prompt / audit |

## Usage examples

### Python

```python
from sandarb import Sandarb, GetContextResult, GetPromptResult

client = Sandarb(base_url="http://localhost:8000", token="your-api-key", agent_id="my-agent-id")

# Unified interface: get_context (inject API), get_prompt (pull API), log_activity
ctx = client.get_context_inject("trading-limits", "my-agent-id")
print(ctx.content, ctx.context_version_id)

prompt = client.get_prompt_pull("customer-support-v1", {"user_tier": "gold"}, agent_id="my-agent-id")
print(prompt.content, prompt.version)

client.log_activity("my-agent-id", "trace-123", {"query": "..."}, {"answer": "..."})
```

### Node (TypeScript)

```ts
import { SandarbClient } from "@sandarb/sdk-node";

const client = new SandarbClient({
  baseUrl: "http://localhost:8000",
  apiKey: process.env.SANDARB_API_KEY,
});

const ctx = await client.getContext("trading-limits", "my-agent-id");
console.log(ctx.content, ctx.context_version_id);

const prompt = await client.getPrompt("customer-support-v1", { user_tier: "gold" }, { agentId: "my-agent-id" });
console.log(prompt.content, prompt.version);

await client.logActivity("my-agent-id", "trace-123", { query: "..." }, { answer: "..." });
```

### Go

```go
package main

import (
	"github.com/sandarb-ai/sandarb.ai/sdk/go/sandarb"
)

func main() {
	client := sandarb.NewClient(
		sandarb.WithBaseURL("http://localhost:8000"),
		sandarb.WithAPIKey("your-api-key"),
	)

	ctx, err := client.GetContext("trading-limits", "my-agent-id")
	if err != nil {
		panic(err)
	}
	_ = ctx.Content
	_ = ctx.ContextVersionID

	prompt, err := client.GetPrompt("customer-support-v1", map[string]interface{}{"user_tier": "gold"}, "my-agent-id", "")
	if err != nil {
		panic(err)
	}
	_ = prompt.Content
	_ = prompt.Version

	_ = client.LogActivity("my-agent-id", "trace-123", map[string]interface{}{"query": "..."}, map[string]interface{}{"answer": "..."})
}
```

### Java

```java
import ai.sandarb.SandarbClient;
import ai.sandarb.GetContextResult;
import ai.sandarb.GetPromptResult;
import java.util.Map;

SandarbClient client = SandarbClient.builder()
    .baseUrl("http://localhost:8000")
    .apiKey("your-api-key")
    .build();

GetContextResult ctx = client.getContext("trading-limits", "my-agent-id");
System.out.println(ctx.getContent() + " " + ctx.getContextVersionId());

GetPromptResult prompt = client.getPrompt("customer-support-v1", Map.of("user_tier", "gold"), "my-agent-id");
System.out.println(prompt.getContent() + " " + prompt.getVersion());

client.logActivity("my-agent-id", "trace-123", Map.of("query", "..."), Map.of("answer", "..."));
```

## Backend requirements

- **Inject**: `GET /api/inject?name={context_name}&format=json` with headers `X-Sandarb-Agent-ID`, `X-Sandarb-Trace-ID`. Response may include `X-Context-Version-ID`.
- **Prompts pull**: `GET /api/prompts/pull?name={prompt_name}` (optional `vars` for variables). Headers: `X-Sandarb-Agent-ID`, `X-Sandarb-Trace-ID`.
- **Activity**: `POST /api/audit/activity` with JSON body `{ agent_id, trace_id, inputs, outputs }`. Writes to `sandarb_access_logs` with `metadata = { inputs, outputs }`.

See [UNIFIED_INTERFACE.md](./UNIFIED_INTERFACE.md) for full contract and schema reference.

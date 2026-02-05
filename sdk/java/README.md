# Sandarb Java SDK

Java client for the [Sandarb AI Governance](https://github.com/sandarb-ai/sandarb.ai) platform. Implements the [unified SDK interface](../UNIFIED_INTERFACE.md): `getContext`, `getPrompt`, `logActivity`. Authentication via API Key (maps to `service_accounts`).

**Requirements:** Java 11+, Maven 3.6+

## Build

```bash
cd sdk/java
mvn compile
# Package: mvn package
# Tests: mvn test
```

From repo root:

```bash
cd sdk/java && mvn compile
```

## Install locally

```bash
mvn install
```

Then in your project (e.g. with Maven):

```xml
<dependency>
  <groupId>ai.sandarb</groupId>
  <artifactId>sandarb-sdk</artifactId>
  <version>1.0.0-SNAPSHOT</version>
</dependency>
```

## Usage

Environment variables (optional): `SANDARB_URL` (default `https://api.sandarb.ai`), `SANDARB_API_KEY`, `SANDARB_AGENT_ID` (default agent for get_prompt).

```java
import ai.sandarb.SandarbClient;
import ai.sandarb.GetContextResult;
import ai.sandarb.GetPromptResult;

SandarbClient client = SandarbClient.builder()
    .baseUrl("http://localhost:8000")
    .apiKey("your-api-key")
    .build();

// Or from env: SandarbClient client = SandarbClient.create();

// Get context (inject API)
GetContextResult ctx = client.getContext("trading-limits", "my-agent-id");
System.out.println(ctx.getContent());
System.out.println(ctx.getContextVersionId());

// Get prompt (pull API) with optional variable substitution
Map<String, Object> vars = Map.of("user_tier", "gold");
GetPromptResult prompt = client.getPrompt("customer-support-v1", vars, "my-agent-id");
System.out.println(prompt.getContent());
System.out.println(prompt.getVersion());

// Log activity (audit API)
client.logActivity("my-agent-id", "trace-123",
    Map.of("query", "..."),
    Map.of("answer", "..."));
```

## API

- **getContext(contextName, agentId)** → `GetContextResult` (content map + optional contextVersionId)
- **getPrompt(promptName, variables, agentId)** → `GetPromptResult` (content, version, model, systemPrompt); overload with explicit traceId available
- **logActivity(agentId, traceId, inputs, outputs)** → void

On HTTP errors (4xx/5xx), the client throws `SandarbException` with `getStatusCode()` and `getBody()`.

## Backend endpoints

- **Inject:** `GET /api/inject?name={context_name}&format=json` — headers: `X-Sandarb-Agent-ID`, `X-Sandarb-Trace-ID`; response header `X-Context-Version-ID`
- **Prompts pull:** `GET /api/prompts/pull?name={prompt_name}&vars=...` — same headers
- **Activity:** `POST /api/audit/activity` — JSON body: `{ agent_id, trace_id, inputs, outputs }`

See [UNIFIED_INTERFACE.md](../UNIFIED_INTERFACE.md) for the full contract.

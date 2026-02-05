# Sandarb Python SDK

The official Python SDK for **Sandarb AI Governance** - govern your AI agents with ease.

## Features

- **Easy Integration**: Simple API for registering agents, fetching governed prompts and contexts
- **Type Safety**: Full Pydantic models for all data types
- **Async Support**: Both sync and async clients for high-performance applications
- **Decorators**: `@governed`, `@audit_action`, `@require_prompt` for declarative governance
- **Framework Integrations**: Built-in support for LangChain, OpenAI, and Anthropic
- **Audit Logging**: Automatic compliance logging for all AI operations

## Installation

```bash
# Basic installation
pip install sandarb

# With async support
pip install sandarb[async]

# With framework integrations
pip install sandarb[langchain]
pip install sandarb[openai]
pip install sandarb[anthropic]

# Everything
pip install sandarb[all]
```

Or install from source:

```bash
cd sdk/python
pip install -e .
```

## Quick Start

```python
from sandarb import Sandarb

# Initialize client
client = Sandarb(
    "https://api.sandarb.ai",
    agent_id="my-agent-v1",
    token="your-token",  # Or set SANDARB_TOKEN env var
)

# Register your agent on startup
client.register(
    agent_id="my-agent-v1",
    name="My AI Agent",
    version="1.0.0",
    url="https://my-agent.example.com/a2a",
    owner_team="platform",
)

# Get governed prompt
prompt = client.get_prompt("customer-support", variables={"tier": "gold"})
system_message = prompt.content

# Get governed context
context = client.get_context("trading-limits")
config = context.content

# Log audit event
client.audit(
    "inference",
    resource_type="llm",
    resource_name="gpt-4",
    details={"tokens": 150, "latency_ms": 230},
)
```

## Configuration

The SDK can be configured via constructor arguments or environment variables:

| Parameter | Environment Variable | Description |
|-----------|---------------------|-------------|
| `base_url` | `SANDARB_URL` | API base URL. **Local dev:** use `http://localhost:8000` (Sandarb running on your laptop). **Production:** use your company’s Sandarb API URL—the service is hosted behind a load balancer or on a protected server; you do not control the endpoint. |
| `token` | `SANDARB_TOKEN` | Bearer token for authenticated calls |
| `agent_id` | `SANDARB_AGENT_ID` | Default agent ID for tracking |

## Core API

### Agent Registration

```python
# Using manifest dict
client.check_in({
    "agent_id": "my-agent",
    "version": "1.0.0",
    "owner_team": "platform",
    "url": "https://my-agent.example.com/a2a",
    "name": "My Agent",
})

# Using named parameters
client.register(
    agent_id="my-agent",
    name="My Agent",
    version="1.0.0",
    url="https://my-agent.example.com/a2a",
    owner_team="platform",
    capabilities=["text-generation", "summarization"],
)
```

### Prompts

```python
# Get prompt with metadata
prompt = client.get_prompt("my-prompt", variables={"key": "value"})
print(prompt.content)  # The prompt text
print(prompt.version)  # Version number

# Get just the content
content = client.pull_prompt("my-prompt")

# List available prompts
prompts = client.list_prompts(tags=["production"])
```

### Contexts

```python
# Get context with validation
context = client.get_context("trading-limits")
print(context.content)
print(context.approved)
print(context.compliance_level)

# Validate before use
validation = client.validate_context("trading-limits", environment="prod")
if validation.approved:
    # Safe to use
    pass

# Inject via REST API
config = client.inject("app-config", format="json")

# List contexts
contexts = client.list_contexts(environment="prod", active_only=True)
```

### Audit Logging

```python
# Log audit event
client.audit(
    "inference",
    resource_type="llm",
    resource_name="gpt-4",
    details={"tokens": 150, "latency_ms": 230},
)

# Convenience log method
client.log("Processing complete", level="info", request_id="req-123")
```

## Decorators

Use decorators for declarative governance:

```python
from sandarb import governed, audit_action, require_prompt, require_context
from sandarb.decorators import configure

# Configure global client
configure("https://api.sandarb.ai", agent_id="my-agent")

# Automatically fetch prompt and context, log audit events
@governed(prompt="customer-support", context="support-policies")
def handle_query(query: str, governed_prompt: str, governed_context: str):
    return llm_call(governed_prompt, governed_context, query)

# Automatically audit function calls
@audit_action("data_access", resource_type="database")
def fetch_user(user_id: str):
    return db.get_user(user_id)

# Require specific prompt
@require_prompt("greeting", variables={"lang": "en"})
def greet(user: str, prompt: str):
    return f"{prompt} {user}!"

# Require specific context
@require_context("config", param_name="config")
def process(data: dict, config: str):
    return transform(data, json.loads(config))
```

## Async Support

```python
from sandarb import AsyncSandarb

async with AsyncSandarb("https://api.sandarb.ai", agent_id="my-agent") as client:
    # All methods are async
    prompt = await client.get_prompt("my-prompt")
    await client.audit("event", details={"key": "value"})
    
    # Parallel operations
    import asyncio
    prompts, contexts = await asyncio.gather(
        client.list_prompts(),
        client.list_contexts(),
    )
```

## Framework Integrations

### OpenAI

```python
from sandarb import Sandarb
from sandarb.integrations.openai import GovernedChatOpenAI

client = Sandarb("https://api.sandarb.ai", agent_id="my-agent")

llm = GovernedChatOpenAI(
    client=client,
    prompt_name="customer-support",  # Auto-fetch governed prompt
    model="gpt-4",
    audit_calls=True,  # Auto-log all calls
)

response = llm.chat("How can I help you?")
```

### LangChain

```python
from langchain_openai import ChatOpenAI
from sandarb.integrations.langchain import SandarbLangChainCallback

# Create callback for automatic audit logging
callback = SandarbLangChainCallback(
    client=sandarb_client,
    log_tokens=True,
)

llm = ChatOpenAI(callbacks=[callback])
response = llm.invoke("Hello!")  # Automatically logged
```

### Anthropic

```python
from sandarb.integrations.anthropic import GovernedAnthropic

llm = GovernedAnthropic(
    client=sandarb_client,
    prompt_name="my-prompt",
    model="claude-3-sonnet-20240229",
)

response = llm.chat("Hello!")
```

## Error Handling

```python
from sandarb import Sandarb, SandarbError

client = Sandarb("https://api.sandarb.ai")

try:
    prompt = client.get_prompt("nonexistent")
except SandarbError as e:
    print(f"Error: {e.message}")
    print(f"Status: {e.status_code}")
    print(f"Body: {e.body}")
```

## Examples

See the `examples/` directory for complete examples:

| Example | Description |
|---------|-------------|
| `basic_usage.py` | Core SDK functionality - registration, prompts, contexts, audit |
| `decorators_example.py` | Using `@governed`, `@audit_action`, `@require_prompt` decorators |
| `openai_example.py` | OpenAI integration with `GovernedChatOpenAI` |
| `langchain_example.py` | LangChain integration with callbacks |
| `async_example.py` | Async client for high-performance applications |

Run an example:

```bash
cd sdk/python
export SANDARB_URL=http://localhost:8000
python examples/basic_usage.py
```

## API Reference

### Sandarb Client

| Method | Description |
|--------|-------------|
| `check_in(manifest)` | Register agent with Sandarb |
| `register(...)` | Register with named parameters |
| `get_prompt(name, variables)` | Get governed prompt with metadata |
| `pull_prompt(name)` | Get prompt content string only |
| `list_prompts(tags)` | List available prompts |
| `get_context(name)` | Get governed context with metadata |
| `validate_context(name)` | Validate context exists and is approved |
| `inject(name, format)` | Get context via REST API |
| `list_contexts()` | List available contexts |
| `audit(event_type, ...)` | Log audit event |
| `log(message, level)` | Log message as audit event |
| `call(skill_id, input)` | Call any A2A skill |
| `get_agent_card()` | Get Sandarb agent metadata |
| `health_check()` | Check API health |
| `set_agent_id(id)` | Set default agent ID |
| `set_trace_id(id)` | Set persistent trace ID |
| `new_trace()` | Generate new trace ID |
| `close()` | Close HTTP session |

### AsyncSandarb Client

All methods from `Sandarb` are available as async versions:

```python
async with AsyncSandarb("https://api.sandarb.ai") as client:
    prompt = await client.get_prompt("my-prompt")
    await client.audit("event")
```

### Decorators

| Decorator | Description |
|-----------|-------------|
| `@governed(prompt, context)` | Auto-fetch prompt/context, inject as kwargs |
| `@audit_action(event_type)` | Auto-log function calls as audit events |
| `@require_prompt(name)` | Require and inject a specific prompt |
| `@require_context(name)` | Require and inject a specific context |
| `configure(url, agent_id)` | Configure global client for decorators |

### Models

| Model | Description |
|-------|-------------|
| `Prompt` | Prompt metadata (id, name, tags, versions) |
| `PromptVersion` | Specific prompt version (content, status) |
| `PromptPullResponse` | Response from get_prompt (content, version) |
| `Context` | Context metadata and content |
| `ContextValidationResponse` | Response from validate_context |
| `Agent` | Registered agent info |
| `Organization` | Organization in hierarchy |
| `AuditEvent` | Audit log event structure |
| `GovernancePolicy` | Governance policy definition |
| `CheckInResponse` | Response from agent registration |

### Integrations

| Integration | Class | Description |
|-------------|-------|-------------|
| OpenAI | `GovernedChatOpenAI` | Governed wrapper for OpenAI Chat API |
| OpenAI (async) | `GovernedAsyncChatOpenAI` | Async version |
| Anthropic | `GovernedAnthropic` | Governed wrapper for Anthropic Claude |
| Anthropic (async) | `GovernedAsyncAnthropic` | Async version |
| LangChain | `SandarbLangChainCallback` | Callback handler for audit logging |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SANDARB_URL` | Sandarb API base URL | `https://api.sandarb.ai` |
| `SANDARB_TOKEN` | Bearer token for authentication | None |
| `SANDARB_AGENT_ID` | Default agent ID | None |

## Troubleshooting

### Connection Errors

```python
# Check if Sandarb is running
client = Sandarb("http://localhost:8000")
if not client.health_check():
    print("Sandarb is not available")
```

### Authentication Errors

```python
# Make sure token is set for authenticated endpoints
client = Sandarb(
    "https://api.sandarb.ai",
    token=os.environ.get("SANDARB_TOKEN"),  # Required for A2A calls
)
```

### Missing Agent ID

```python
# Some methods require agent_id
client = Sandarb("https://api.sandarb.ai", agent_id="my-agent")

# Or set it later
client.set_agent_id("my-agent")

# get_context requires agent_id for policy checks
context = client.get_context("trading-limits")  # Will fail without agent_id
```

### Context Not Found

```python
try:
    context = client.get_context("nonexistent")
except SandarbError as e:
    if e.status_code == 404:
        print("Context does not exist")
    elif e.status_code == 403:
        print("Agent not authorized to access this context")
```

## Best Practices

### 1. Register on Startup

```python
# In your agent's main.py or startup code
from sandarb import Sandarb

client = Sandarb(os.environ["SANDARB_URL"], agent_id="my-agent")

# Register immediately on startup
client.register(
    agent_id="my-agent",
    name="My Agent",
    version=__version__,
    url=f"http://{HOST}:{PORT}/a2a",
    owner_team="platform",
)
```

### 2. Use Context Managers

```python
# Sync
with Sandarb("https://api.sandarb.ai") as client:
    prompt = client.get_prompt("my-prompt")

# Async
async with AsyncSandarb("https://api.sandarb.ai") as client:
    prompt = await client.get_prompt("my-prompt")
```

### 3. Set Trace IDs for Request Correlation

```python
# Generate trace ID at request start
trace_id = client.new_trace()

# All subsequent calls use this trace ID
client.get_prompt("my-prompt")
client.get_context("my-context")
client.audit("inference", details={"trace_id": trace_id})
```

### 4. Use Decorators for Clean Code

```python
from sandarb import governed, configure

configure("https://api.sandarb.ai", agent_id="my-agent")

@governed(prompt="customer-support")
def handle_request(query: str, governed_prompt: str):
    # No boilerplate - prompt is injected automatically
    return llm(governed_prompt, query)
```

### 5. Audit Important Events

```python
# Log meaningful events for compliance
client.audit("user_query", details={"query_type": "password_reset"})
client.audit("llm_response", details={"tokens": 150, "model": "gpt-4"})
client.audit("action_taken", details={"action": "email_sent"})
```

## Migration from Old SDK

If you were using the old `sandarb_client.py`:

```python
# Old
from sandarb_client import SandarbClient
client = SandarbClient("https://api.sandarb.ai")
result = client.get_prompt("name")

# New
from sandarb import Sandarb
client = Sandarb("https://api.sandarb.ai")
result = client.get_prompt("name")
# Now returns PromptPullResponse with .content, .version, etc.
```

## License

Apache 2.0 - See LICENSE for details.

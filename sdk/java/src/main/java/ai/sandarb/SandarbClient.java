package ai.sandarb;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;

/**
 * Sandarb SDK client. Implements the unified interface: getContext, getPrompt, logActivity.
 * Authentication via API Key (maps to service_accounts). Same contract as Python, Node, and Go SDKs.
 */
public class SandarbClient {

    private static final String DEFAULT_BASE_URL = "https://api.sandarb.ai";
    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(30);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String baseUrl;
    private final String apiKey;
    private final HttpClient httpClient;

    private SandarbClient(Builder b) {
        String base = b.baseUrl != null ? b.baseUrl : System.getenv("SANDARB_URL");
        if (base == null || base.isEmpty()) {
            base = DEFAULT_BASE_URL;
        }
        this.baseUrl = base.replaceAll("/+$", "");
        this.apiKey = b.apiKey != null ? b.apiKey : System.getenv("SANDARB_API_KEY");
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(DEFAULT_TIMEOUT)
                .build();
    }

    public static Builder builder() {
        return new Builder();
    }

    /**
     * Create a client using SANDARB_URL and SANDARB_API_KEY from the environment.
     */
    public static SandarbClient create() {
        return builder().build();
    }

    private String traceId() {
        return UUID.randomUUID().toString();
    }

    private HttpRequest.Builder newRequest(String path, String agentId, String traceId) {
        HttpRequest.Builder rb = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(DEFAULT_TIMEOUT)
                .header("Accept", "application/json")
                .header("Content-Type", "application/json");
        if (apiKey != null && !apiKey.isEmpty()) {
            rb.header("Authorization", "Bearer " + apiKey);
        }
        if (agentId != null && !agentId.isEmpty()) {
            rb.header("X-Sandarb-Agent-ID", agentId);
        }
        if (traceId != null && !traceId.isEmpty()) {
            rb.header("X-Sandarb-Trace-ID", traceId);
        }
        return rb;
    }

    private void checkResponse(HttpResponse<String> resp) {
        if (resp.statusCode() >= 200 && resp.statusCode() < 300) {
            return;
        }
        throw new SandarbException(
                "API error: " + resp.statusCode(),
                resp.statusCode(),
                resp.body()
        );
    }

    /**
     * Fetches the current approved context by name for the given agent.
     * Backend: GET /api/inject?name={context_name}&format=json.
     *
     * @param contextName unique context name (e.g. trading-limits)
     * @param agentId     calling agent identifier (must match a registered agent)
     * @return content (JSONB payload) and optional context_version_id from X-Context-Version-ID header
     */
    public GetContextResult getContext(String contextName, String agentId) {
        String traceId = traceId();
        String path = "/api/inject?name=" + URLEncoder.encode(contextName, StandardCharsets.UTF_8) + "&format=json";
        HttpRequest req = newRequest(path, agentId, traceId).GET().build();
        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            checkResponse(resp);
            Map<String, Object> content = resp.body() == null || resp.body().isEmpty()
                    ? Collections.emptyMap()
                    : MAPPER.readValue(resp.body(), new TypeReference<Map<String, Object>>() {});
            String contextVersionId = resp.headers().firstValue("X-Context-Version-ID").orElse(null);
            return new GetContextResult(content, contextVersionId);
        } catch (SandarbException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("get_context failed", e);
        }
    }

    /**
     * Fetches the current approved prompt by name with optional variable substitution.
     * Backend: GET /api/prompts/pull?name={prompt_name}&vars=... (optional).
     *
     * @param promptName unique prompt name (e.g. customer-support-v1)
     * @param variables  optional key-value map for {{variable}} substitution (may be null or empty)
     * @param agentId    calling agent identifier (required; or set SANDARB_AGENT_ID)
     * @return compiled prompt text and version info
     */
    public GetPromptResult getPrompt(String promptName, Map<String, Object> variables, String agentId) {
        return getPrompt(promptName, variables, agentId, traceId());
    }

    /**
     * Same as getPrompt(..., agentId) with explicit traceId.
     */
    public GetPromptResult getPrompt(String promptName, Map<String, Object> variables, String agentId, String traceId) {
        String aid = agentId != null ? agentId : System.getenv("SANDARB_AGENT_ID");
        if (aid == null || aid.isEmpty()) {
            throw new IllegalArgumentException("agent_id is required for get_prompt (or set SANDARB_AGENT_ID)");
        }
        String tid = traceId != null ? traceId : traceId();
        StringBuilder path = new StringBuilder("/api/prompts/pull?name=").append(URLEncoder.encode(promptName, StandardCharsets.UTF_8));
        if (variables != null && !variables.isEmpty()) {
            try {
                String varsJson = MAPPER.writeValueAsString(variables);
                path.append("&vars=").append(URLEncoder.encode(varsJson, StandardCharsets.UTF_8));
            } catch (Exception e) {
                throw new RuntimeException("serialize variables", e);
            }
        }
        HttpRequest req = newRequest(path.toString(), aid, tid).GET().build();
        try {
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            checkResponse(resp);
            Map<String, Object> envelope = MAPPER.readValue(resp.body(), new TypeReference<Map<String, Object>>() {});
            Object dataObj = envelope.get("data");
            if (!Boolean.TRUE.equals(envelope.get("success")) || !(dataObj instanceof Map)) {
                throw new SandarbException("Invalid get_prompt response", resp.statusCode(), resp.body());
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) dataObj;
            String content = data.get("content") != null ? data.get("content").toString() : "";
            Number ver = (Number) data.get("version");
            int version = ver != null ? ver.intValue() : 0;
            String model = data.get("model") != null ? data.get("model").toString() : null;
            String systemPrompt = data.get("systemPrompt") != null ? data.get("systemPrompt").toString() : null;
            return new GetPromptResult(content, version, model, systemPrompt);
        } catch (SandarbException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("get_prompt failed", e);
        }
    }

    /**
     * Writes an activity record to sandarb_access_logs (metadata = { inputs, outputs }).
     * Backend: POST /api/audit/activity.
     *
     * @param agentId calling agent identifier
     * @param traceId request/correlation ID
     * @param inputs  JSON-serializable request/input payload (may be null)
     * @param outputs JSON-serializable response/output payload (may be null)
     */
    public void logActivity(String agentId, String traceId, Map<String, Object> inputs, Map<String, Object> outputs) {
        Map<String, Object> in = inputs != null ? inputs : Collections.emptyMap();
        Map<String, Object> out = outputs != null ? outputs : Collections.emptyMap();
        Map<String, Object> body = Map.of(
                "agent_id", agentId,
                "trace_id", traceId,
                "inputs", in,
                "outputs", out
        );
        try {
            String json = MAPPER.writeValueAsString(body);
            HttpRequest req = newRequest("/api/audit/activity", agentId, traceId)
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            checkResponse(resp);
        } catch (SandarbException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("log_activity failed", e);
        }
    }

    public static final class Builder {
        private String baseUrl;
        private String apiKey;

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        public SandarbClient build() {
            return new SandarbClient(this);
        }
    }
}

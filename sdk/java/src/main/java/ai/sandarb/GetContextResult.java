package ai.sandarb;

import java.util.Map;

/**
 * Result of get_context: content (from context_versions.content JSONB) and optional context_version_id.
 */
public class GetContextResult {

    private Map<String, Object> content;
    private String contextVersionId;

    public GetContextResult() {
    }

    public GetContextResult(Map<String, Object> content, String contextVersionId) {
        this.content = content;
        this.contextVersionId = contextVersionId;
    }

    public Map<String, Object> getContent() {
        return content;
    }

    public void setContent(Map<String, Object> content) {
        this.content = content;
    }

    public String getContextVersionId() {
        return contextVersionId;
    }

    public void setContextVersionId(String contextVersionId) {
        this.contextVersionId = contextVersionId;
    }
}

package ai.sandarb;

/**
 * Result of get_prompt: compiled prompt text and version info (from prompt_versions).
 */
public class GetPromptResult {

    private String content;
    private int version;
    private String model;
    private String systemPrompt;

    public GetPromptResult() {
    }

    public GetPromptResult(String content, int version, String model, String systemPrompt) {
        this.content = content;
        this.version = version;
        this.model = model;
        this.systemPrompt = systemPrompt;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getSystemPrompt() {
        return systemPrompt;
    }

    public void setSystemPrompt(String systemPrompt) {
        this.systemPrompt = systemPrompt;
    }
}

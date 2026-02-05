package ai.sandarb;

/**
 * Thrown when a Sandarb API call fails (HTTP 4xx/5xx).
 */
public class SandarbException extends RuntimeException {

    private final int statusCode;
    private final String body;

    public SandarbException(String message, int statusCode, String body) {
        super(String.format("sandarb: %s (status %d)", message, statusCode));
        this.statusCode = statusCode;
        this.body = body != null ? body : "";
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getBody() {
        return body;
    }
}

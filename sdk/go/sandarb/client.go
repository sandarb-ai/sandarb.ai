package sandarb

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/google/uuid"
)

// SandarbError is returned when an API call fails.
type SandarbError struct {
	Message    string
	StatusCode int
	Body       string
}

func (e *SandarbError) Error() string {
	return fmt.Sprintf("sandarb: %s (status %d)", e.Message, e.StatusCode)
}

// Client is the Sandarb SDK client. Same interface as Python and Node SDKs.
type Client struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
}

// ClientOption configures the Client.
type ClientOption func(*Client)

// WithBaseURL sets the API base URL.
func WithBaseURL(base string) ClientOption {
	return func(c *Client) { c.BaseURL = base }
}

// WithAPIKey sets the API key (service_accounts).
func WithAPIKey(key string) ClientOption {
	return func(c *Client) { c.APIKey = key }
}

// WithTimeout sets the HTTP client timeout.
func WithTimeout(d time.Duration) ClientOption {
	return func(c *Client) {
		if c.HTTPClient == nil {
			c.HTTPClient = &http.Client{}
		}
		c.HTTPClient.Timeout = d
	}
}

// NewClient creates a Sandarb client. API key defaults to SANDARB_API_KEY env.
func NewClient(opts ...ClientOption) *Client {
	base := os.Getenv("SANDARB_URL")
	if base == "" {
		base = "https://api.sandarb.ai"
	}
	// trim trailing slash
	if len(base) > 0 && base[len(base)-1] == '/' {
		base = base[:len(base)-1]
	}
	c := &Client{
		BaseURL:    base,
		APIKey:     os.Getenv("SANDARB_API_KEY"),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

func (c *Client) headers(agentID, traceID string) map[string]string {
	h := map[string]string{
		"Content-Type": "application/json",
		"Accept":       "application/json",
	}
	if c.APIKey != "" {
		h["Authorization"] = "Bearer " + c.APIKey
	}
	if agentID != "" {
		h["X-Sandarb-Agent-ID"] = agentID
	}
	if traceID != "" {
		h["X-Sandarb-Trace-ID"] = traceID
	}
	return h
}

func (c *Client) do(req *http.Request) (*http.Response, error) {
	if c.HTTPClient == nil {
		c.HTTPClient = &http.Client{Timeout: 30 * time.Second}
	}
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, &SandarbError{
			Message:    fmt.Sprintf("API error: %s", resp.Status),
			StatusCode: resp.StatusCode,
			Body:       string(body),
		}
	}
	return resp, nil
}

// GetContext fetches context by name for the given agent.
// Returns content + context_version_id (from context_versions).
func (c *Client) GetContext(ctxName, agentID string) (*GetContextResult, error) {
	traceID := uuid.New().String()
	u := c.BaseURL + "/api/inject?name=" + url.QueryEscape(ctxName) + "&format=json"
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	for k, v := range c.headers(agentID, traceID) {
		req.Header.Set(k, v)
	}
	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var content map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&content); err != nil {
		return nil, err
	}
	if content == nil {
		content = make(map[string]interface{})
	}
	out := &GetContextResult{Content: content}
	if v := resp.Header.Get("X-Context-Version-ID"); v != "" {
		out.ContextVersionID = &v
	}
	return out, nil
}

// GetPrompt fetches compiled prompt by name with optional variable substitution.
// agentID is required (or set SANDARB_AGENT_ID).
func (c *Client) GetPrompt(promptName string, variables map[string]interface{}, agentID, traceID string) (*GetPromptResult, error) {
	if agentID == "" {
		agentID = os.Getenv("SANDARB_AGENT_ID")
	}
	if agentID == "" {
		return nil, fmt.Errorf("agent_id is required for GetPrompt (or set SANDARB_AGENT_ID)")
	}
	if traceID == "" {
		traceID = uuid.New().String()
	}
	u := c.BaseURL + "/api/prompts/pull?name=" + url.QueryEscape(promptName)
	if len(variables) > 0 {
		b, _ := json.Marshal(variables)
		u += "&vars=" + url.QueryEscape(string(b))
	}
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	for k, v := range c.headers(agentID, traceID) {
		req.Header.Set(k, v)
	}
	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var envelope struct {
		Success bool `json:"success"`
		Data    struct {
			Content       string  `json:"content"`
			Version       int     `json:"version"`
			Model         *string `json:"model"`
			SystemPrompt  *string `json:"systemPrompt"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return nil, err
	}
	if !envelope.Success {
		return nil, &SandarbError{Message: "invalid get_prompt response", StatusCode: resp.StatusCode}
	}
	out := &GetPromptResult{
		Content:      envelope.Data.Content,
		Version:      envelope.Data.Version,
		Model:        envelope.Data.Model,
		SystemPrompt: envelope.Data.SystemPrompt,
	}
	return out, nil
}

// LogActivity writes an activity record to sandarb_access_logs (metadata = { inputs, outputs }).
func (c *Client) LogActivity(agentID, traceID string, inputs, outputs map[string]interface{}) error {
	if inputs == nil {
		inputs = make(map[string]interface{})
	}
	if outputs == nil {
		outputs = make(map[string]interface{})
	}
	body := map[string]interface{}{
		"agent_id": agentID,
		"trace_id": traceID,
		"inputs":   inputs,
		"outputs":  outputs,
	}
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/audit/activity", bytes.NewReader(b))
	if err != nil {
		return err
	}
	for k, v := range c.headers(agentID, traceID) {
		req.Header.Set(k, v)
	}
	resp, err := c.do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

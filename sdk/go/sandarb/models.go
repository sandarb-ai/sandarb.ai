// Package sandarb provides the Sandarb AI Governance SDK (Go).
// Unified interface: GetContext, GetPrompt, LogActivity.
// Types align with schema/sandarb.sql: contexts, context_versions, prompts, prompt_versions, sandarb_access_logs.
package sandarb

// GetContextResult is the result of GetContext: content + context_version_id (from context_versions).
type GetContextResult struct {
	Content          map[string]interface{} `json:"content"`
	ContextVersionID  *string               `json:"context_version_id,omitempty"`
}

// GetPromptResult is the result of GetPrompt: compiled prompt text and version info (from prompt_versions).
type GetPromptResult struct {
	Content      string  `json:"content"`
	Version      int     `json:"version"`
	Model        *string `json:"model,omitempty"`
	SystemPrompt *string `json:"system_prompt,omitempty"`
}

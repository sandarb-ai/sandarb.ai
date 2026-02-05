#!/usr/bin/env python3
"""
Sandarb Decorators Example

This example demonstrates using decorators for easy governance integration.
"""

import os
from sandarb import Sandarb, governed, audit_action, require_prompt, require_context
from sandarb.decorators import configure

# Configure the global client for decorators
configure(
    os.environ.get("SANDARB_URL", "http://localhost:8000"),
    agent_id="decorator-example-agent",
    token=os.environ.get("SANDARB_TOKEN"),
)


# Example 1: Using @governed decorator
# This automatically fetches prompt and context, and logs audit events
@governed(prompt="customer-support", context="support-policies")
def handle_customer_query(
    query: str,
    governed_prompt: str = "",  # Injected by decorator
    governed_context: str = "",  # Injected by decorator
) -> str:
    """Handle a customer query with governed prompt and context."""
    print(f"Using governed prompt: {governed_prompt[:50]}...")
    print(f"Using governed context: {governed_context[:50]}...")
    
    # In real usage, you'd pass these to your LLM
    # response = llm.generate(governed_prompt, governed_context, query)
    return f"Handled query: {query}"


# Example 2: Using @audit_action decorator
# This automatically logs audit events for function calls
@audit_action("data_access", resource_type="database", include_args=True)
def fetch_user_data(user_id: str) -> dict:
    """Fetch user data with automatic audit logging."""
    # In real usage, this would query a database
    return {"user_id": user_id, "name": "John Doe", "tier": "gold"}


# Example 3: Using @require_prompt decorator
# This fetches a specific prompt and injects it
@require_prompt("greeting-prompt", variables={"language": "en"})
def generate_greeting(user_name: str, prompt: str = "") -> str:
    """Generate a greeting using a governed prompt."""
    # The prompt parameter is automatically populated
    return f"[{prompt}] Hello, {user_name}!"


# Example 4: Using @require_context decorator
# This fetches a specific context and injects it
@require_context("trading-limits", param_name="limits")
def check_trade_allowed(amount: float, limits: str = "") -> bool:
    """Check if a trade is within limits using governed context."""
    import json
    try:
        limit_data = json.loads(limits)
        max_amount = limit_data.get("max_trade_amount", 10000)
        return amount <= max_amount
    except (json.JSONDecodeError, TypeError):
        return False


# Example 5: Using decorators with async functions
@governed(prompt="async-agent-prompt", audit_on_call=True)
async def async_handler(input_text: str, governed_prompt: str = "") -> str:
    """Async handler with governance."""
    import asyncio
    await asyncio.sleep(0.1)  # Simulate async work
    return f"Processed: {input_text}"


# Example 6: Decorator with error handling
@audit_action("risky_operation", include_result=True)
def risky_operation(value: int) -> int:
    """Operation that might fail - errors are automatically logged."""
    if value < 0:
        raise ValueError("Value must be positive")
    return value * 2


def main():
    print("Sandarb Decorators Example")
    print("=" * 50)
    
    # Note: These examples require the corresponding prompts/contexts
    # to exist in your Sandarb instance. The decorators will raise
    # errors if the resources don't exist (unless fail_silently=True).
    
    print("\n1. @governed decorator example:")
    try:
        result = handle_customer_query("How do I reset my password?")
        print(f"   Result: {result}")
    except Exception as e:
        print(f"   Note: {e} (prompt/context may not exist)")
    
    print("\n2. @audit_action decorator example:")
    try:
        user = fetch_user_data("user-123")
        print(f"   Fetched user: {user['name']}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n3. @require_prompt decorator example:")
    try:
        greeting = generate_greeting("Alice")
        print(f"   Greeting: {greeting}")
    except Exception as e:
        print(f"   Note: {e} (prompt may not exist)")
    
    print("\n4. @require_context decorator example:")
    try:
        allowed = check_trade_allowed(5000)
        print(f"   Trade allowed: {allowed}")
    except Exception as e:
        print(f"   Note: {e} (context may not exist)")
    
    print("\n5. @audit_action with error handling:")
    try:
        result = risky_operation(10)
        print(f"   Result: {result}")
        
        # This will raise and be logged
        risky_operation(-5)
    except ValueError as e:
        print(f"   Expected error caught and logged: {e}")
    
    print("\n✓ Decorators example completed!")


if __name__ == "__main__":
    main()

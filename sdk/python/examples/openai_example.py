#!/usr/bin/env python3
"""
OpenAI Integration Example

This example demonstrates using the Sandarb SDK with OpenAI's API
for governed LLM interactions.

Requirements:
    pip install sandarb[openai]
    export OPENAI_API_KEY=your-key
    export SANDARB_URL=http://localhost:8000
"""

import os
from sandarb import Sandarb

# Check for OpenAI
try:
    from sandarb.integrations.openai import GovernedChatOpenAI
except ImportError:
    print("OpenAI integration not installed. Run: pip install sandarb[openai]")
    exit(1)


def main():
    print("Sandarb + OpenAI Integration Example")
    print("=" * 50)
    
    # Initialize Sandarb client
    sandarb = Sandarb(
        os.environ.get("SANDARB_URL", "http://localhost:8000"),
        agent_id="openai-example-agent",
        token=os.environ.get("SANDARB_TOKEN"),
    )
    
    # Create governed OpenAI wrapper
    llm = GovernedChatOpenAI(
        client=sandarb,
        prompt_name="customer-support",  # Will fetch this governed prompt
        model="gpt-3.5-turbo",  # Use cheaper model for demo
        audit_calls=True,  # Log all calls to Sandarb
    )
    
    print("\n1. Basic chat with governed prompt:")
    try:
        response = llm.chat(
            "How do I reset my password?",
            prompt_variables={"user_tier": "gold"},  # Interpolate into prompt
        )
        print(f"   Response: {response[:200]}...")
    except Exception as e:
        print(f"   Error: {e}")
        print("   (Make sure OPENAI_API_KEY is set and prompt exists)")
    
    print("\n2. Chat with custom system prompt (bypass governance):")
    try:
        response = llm.chat(
            "What is 2 + 2?",
            system_prompt="You are a helpful math tutor. Be concise.",
        )
        print(f"   Response: {response}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n3. Chat with context injection:")
    try:
        response = llm.chat(
            "What are my trading limits?",
            prompt_name="trading-assistant",
            context_name="trading-limits",  # Inject context into system prompt
        )
        print(f"   Response: {response[:200]}...")
    except Exception as e:
        print(f"   Error: {e}")
        print("   (Context may not exist)")
    
    print("\n4. Direct usage without wrapper:")
    try:
        # Get governed prompt directly
        prompt = sandarb.pull_prompt("customer-support")
        
        # Use with any OpenAI client
        from openai import OpenAI
        openai_client = OpenAI()
        
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": "Hello!"},
            ],
        )
        
        # Log audit event
        sandarb.audit(
            "llm_call",
            resource_type="openai",
            resource_name="gpt-3.5-turbo",
            details={
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            },
        )
        
        print(f"   Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n✓ OpenAI example completed!")


if __name__ == "__main__":
    main()

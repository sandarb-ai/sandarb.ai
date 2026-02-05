#!/usr/bin/env python3
"""
Basic Sandarb SDK Usage Example

This example demonstrates the core functionality of the Sandarb SDK
for AI governance.
"""

import os
from sandarb import Sandarb, SandarbError

# Initialize the client
# You can also set SANDARB_URL and SANDARB_TOKEN environment variables
client = Sandarb(
    os.environ.get("SANDARB_URL", "http://localhost:8000"),
    token=os.environ.get("SANDARB_TOKEN"),
    agent_id="example-agent-v1",
)


def main():
    # 1. Check API health
    print("1. Checking API health...")
    if client.health_check():
        print("   ✓ Sandarb API is healthy")
    else:
        print("   ✗ Sandarb API is not available")
        return

    # 2. Register agent (check-in)
    print("\n2. Registering agent...")
    try:
        response = client.register(
            agent_id="example-agent-v1",
            name="Example Agent",
            version="1.0.0",
            url="http://localhost:9000/a2a",
            owner_team="platform",
            description="An example agent demonstrating Sandarb SDK",
            capabilities=["text-generation", "summarization"],
        )
        print(f"   ✓ Agent registered: {response.agent_id}")
    except SandarbError as e:
        print(f"   Note: {e.message}")

    # 3. List available prompts
    print("\n3. Listing available prompts...")
    try:
        prompts = client.list_prompts()
        print(f"   Found {len(prompts)} prompts")
        for p in prompts[:3]:  # Show first 3
            print(f"   - {p.get('name', 'unnamed')}")
    except SandarbError as e:
        print(f"   Error: {e.message}")

    # 4. Get a governed prompt
    print("\n4. Getting governed prompt...")
    try:
        prompt = client.get_prompt(
            "customer-support-v1",  # Replace with actual prompt name
            variables={"user_tier": "gold"},
        )
        print(f"   ✓ Got prompt (version {prompt.version})")
        print(f"   Content preview: {prompt.content[:100]}...")
    except SandarbError as e:
        print(f"   Note: {e.message}")

    # 5. List available contexts
    print("\n5. Listing available contexts...")
    try:
        contexts = client.list_contexts(active_only=True)
        print(f"   Found {len(contexts)} active contexts")
        for c in contexts[:3]:
            print(f"   - {c.get('name', 'unnamed')}")
    except SandarbError as e:
        print(f"   Error: {e.message}")

    # 6. Get a governed context
    print("\n6. Getting governed context...")
    try:
        context = client.get_context("trading-limits")  # Replace with actual context
        print(f"   ✓ Got context: {context.name}")
        print(f"   Approved: {context.approved}")
    except SandarbError as e:
        print(f"   Note: {e.message}")

    # 7. Log audit events
    print("\n7. Logging audit event...")
    try:
        client.audit(
            "example_action",
            resource_type="demo",
            resource_name="basic-usage-example",
            details={
                "action": "demonstration",
                "tokens_used": 150,
                "latency_ms": 230,
            },
        )
        print("   ✓ Audit event logged")
    except SandarbError as e:
        print(f"   Note: {e.message}")

    # 8. Use convenience log method
    print("\n8. Using log convenience method...")
    try:
        client.log("Example completed successfully", level="info", example_id="basic-001")
        print("   ✓ Log message sent")
    except SandarbError as e:
        print(f"   Note: {e.message}")

    print("\n✓ Basic usage example completed!")


if __name__ == "__main__":
    main()

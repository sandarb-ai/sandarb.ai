#!/usr/bin/env python3
"""
Async Sandarb SDK Example

This example demonstrates using the async client for high-performance
applications.

Requirements:
    pip install sandarb[async]
"""

import asyncio
import os
from sandarb import AsyncSandarb, SandarbError


async def main():
    print("Sandarb Async Client Example")
    print("=" * 50)
    
    # Use async context manager for automatic cleanup
    async with AsyncSandarb(
        os.environ.get("SANDARB_URL", "http://localhost:8000"),
        agent_id="async-example-agent",
        token=os.environ.get("SANDARB_TOKEN"),
    ) as client:
        
        # 1. Health check
        print("\n1. Async health check:")
        healthy = await client.health_check()
        print(f"   API healthy: {healthy}")
        
        # 2. Register agent
        print("\n2. Async agent registration:")
        try:
            response = await client.register(
                agent_id="async-example-agent",
                name="Async Example Agent",
                version="1.0.0",
                url="http://localhost:9000/a2a",
                owner_team="platform",
            )
            print(f"   Registered: {response.agent_id}")
        except SandarbError as e:
            print(f"   Note: {e.message}")
        
        # 3. Parallel operations
        print("\n3. Parallel async operations:")
        try:
            # Fetch multiple resources concurrently
            prompts_task = client.list_prompts()
            contexts_task = client.list_contexts()
            
            prompts, contexts = await asyncio.gather(
                prompts_task,
                contexts_task,
                return_exceptions=True,
            )
            
            if not isinstance(prompts, Exception):
                print(f"   Prompts: {len(prompts)}")
            if not isinstance(contexts, Exception):
                print(f"   Contexts: {len(contexts)}")
        except Exception as e:
            print(f"   Error: {e}")
        
        # 4. Get prompt asynchronously
        print("\n4. Async prompt fetch:")
        try:
            prompt = await client.get_prompt("customer-support")
            print(f"   Got prompt (version {prompt.version})")
        except SandarbError as e:
            print(f"   Note: {e.message}")
        
        # 5. Async audit logging
        print("\n5. Async audit logging:")
        try:
            # Log multiple events concurrently
            await asyncio.gather(
                client.audit("event_1", details={"step": 1}),
                client.audit("event_2", details={"step": 2}),
                client.audit("event_3", details={"step": 3}),
            )
            print("   3 events logged concurrently")
        except SandarbError as e:
            print(f"   Note: {e.message}")
        
        # 6. Async context injection
        print("\n6. Async context injection:")
        try:
            config = await client.inject("app-config", format="json")
            print(f"   Got config: {type(config)}")
        except SandarbError as e:
            print(f"   Note: {e.message}")
    
    print("\n✓ Async example completed!")


# Example: High-throughput audit logging
async def batch_audit_example():
    """Example of high-throughput audit logging."""
    async with AsyncSandarb(
        os.environ.get("SANDARB_URL", "http://localhost:8000"),
        agent_id="batch-audit-agent",
    ) as client:
        
        # Generate many audit events
        events = [
            client.audit(
                "batch_event",
                details={"index": i, "data": f"event-{i}"},
            )
            for i in range(100)
        ]
        
        # Execute all concurrently
        results = await asyncio.gather(*events, return_exceptions=True)
        
        success = sum(1 for r in results if not isinstance(r, Exception))
        print(f"Successfully logged {success}/100 events")


# Example: Async agent with governed prompts
async def governed_agent_example():
    """Example of an async agent using governed prompts."""
    async with AsyncSandarb(
        os.environ.get("SANDARB_URL", "http://localhost:8000"),
        agent_id="governed-async-agent",
    ) as client:
        
        # Simulate handling multiple requests concurrently
        async def handle_request(request_id: str, query: str):
            try:
                # Get governed prompt
                prompt = await client.pull_prompt("customer-support")
                
                # Simulate LLM call
                await asyncio.sleep(0.1)
                response = f"[{request_id}] Handled: {query}"
                
                # Log audit
                await client.audit(
                    "request_handled",
                    details={
                        "request_id": request_id,
                        "query_length": len(query),
                    },
                )
                
                return response
            except SandarbError:
                return f"[{request_id}] Error handling request"
        
        # Handle multiple requests concurrently
        requests = [
            ("req-1", "How do I reset my password?"),
            ("req-2", "What are your business hours?"),
            ("req-3", "Can I speak to a manager?"),
        ]
        
        responses = await asyncio.gather(
            *[handle_request(rid, q) for rid, q in requests]
        )
        
        for resp in responses:
            print(resp)


if __name__ == "__main__":
    asyncio.run(main())

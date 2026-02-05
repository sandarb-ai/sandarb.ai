#!/usr/bin/env python3
"""
LangChain Integration Example

This example demonstrates using the Sandarb SDK with LangChain
for governed AI chains and agents.

Requirements:
    pip install sandarb[langchain]
    pip install langchain-openai
    export OPENAI_API_KEY=your-key
    export SANDARB_URL=http://localhost:8000
"""

import os
from sandarb import Sandarb

# Check for LangChain
try:
    from sandarb.integrations.langchain import (
        SandarbLangChainCallback,
        get_governed_prompt_template,
    )
    from langchain_core.prompts import ChatPromptTemplate
except ImportError:
    print("LangChain integration not installed. Run: pip install sandarb[langchain]")
    exit(1)

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    print("langchain-openai not installed. Run: pip install langchain-openai")
    exit(1)


def main():
    print("Sandarb + LangChain Integration Example")
    print("=" * 50)
    
    # Initialize Sandarb client
    sandarb = Sandarb(
        os.environ.get("SANDARB_URL", "http://localhost:8000"),
        agent_id="langchain-example-agent",
        token=os.environ.get("SANDARB_TOKEN"),
    )
    
    # Create callback handler for automatic audit logging
    callback = SandarbLangChainCallback(
        client=sandarb,
        log_prompts=False,  # Don't log prompt content (privacy)
        log_responses=False,  # Don't log response content
        log_tokens=True,  # Log token usage
    )
    
    print("\n1. Basic LLM with Sandarb callback:")
    try:
        llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            callbacks=[callback],
        )
        response = llm.invoke("What is the capital of France?")
        print(f"   Response: {response.content}")
        print("   (Audit events logged automatically)")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n2. Using governed prompt template:")
    try:
        # Fetch governed prompt from Sandarb
        system_prompt = get_governed_prompt_template(
            sandarb,
            "customer-support",
            variables={"user_tier": "gold"},
        )
        
        # Create LangChain prompt template
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
        ])
        
        # Create chain
        chain = prompt | llm
        
        response = chain.invoke({"input": "How do I reset my password?"})
        print(f"   Response: {response.content[:200]}...")
    except Exception as e:
        print(f"   Error: {e}")
        print("   (Prompt may not exist)")
    
    print("\n3. Chain with multiple steps:")
    try:
        from langchain_core.output_parsers import StrOutputParser
        
        # Create a simple chain
        chain = (
            ChatPromptTemplate.from_messages([
                ("system", "You are a helpful assistant. Be concise."),
                ("human", "{question}"),
            ])
            | ChatOpenAI(model="gpt-3.5-turbo", callbacks=[callback])
            | StrOutputParser()
        )
        
        result = chain.invoke({"question": "What is 2+2?"})
        print(f"   Result: {result}")
        print("   (Chain start/end events logged)")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n4. Manual audit logging with LangChain:")
    try:
        # You can also log custom events
        sandarb.audit(
            "langchain_workflow",
            resource_type="chain",
            resource_name="customer-support-chain",
            details={
                "workflow_id": "wf-001",
                "steps": ["prompt", "llm", "parse"],
            },
        )
        print("   Custom audit event logged")
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n✓ LangChain example completed!")


if __name__ == "__main__":
    main()

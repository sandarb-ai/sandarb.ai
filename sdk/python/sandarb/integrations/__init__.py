"""
Sandarb Framework Integrations

Optional integrations with popular AI frameworks.

Install extras for specific integrations:
    pip install sandarb[langchain]
    pip install sandarb[openai]
    pip install sandarb[anthropic]
    pip install sandarb[all]
"""

from sandarb.integrations.base import GovernedLLMBase

__all__ = ["GovernedLLMBase"]

# Lazy imports for optional dependencies
def __getattr__(name: str):
    if name == "SandarbLangChainCallback":
        from sandarb.integrations.langchain import SandarbLangChainCallback
        return SandarbLangChainCallback
    if name == "GovernedChatOpenAI":
        from sandarb.integrations.openai import GovernedChatOpenAI
        return GovernedChatOpenAI
    if name == "GovernedAnthropic":
        from sandarb.integrations.anthropic import GovernedAnthropic
        return GovernedAnthropic
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

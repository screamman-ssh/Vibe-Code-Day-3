---
name: exa
description: >
  Neural semantic web search. Use when standard keyword search or web search is
  insufficient, or when looking for highly specific documentation, API references,
  or conceptual matches.
---

# Exa Neural Search

Exa is a neural search engine built for AI agents. It uses semantic embeddings to search the web based on meaning and context rather than exact keywords.

## Setup Requirements

To use Exa, you must obtain an API key from the [Exa Dashboard](https://dashboard.exa.ai/) and set it in your environment:
- As an environment variable: `EXA_API_KEY`
- Or configured in `C:\Users\autog\.gemini\antigravity-ide\mcp_config.json`

## Guidelines

- **Phrase search (Auto-complete)**: Formulate queries as if completing a sentence or statement on the target page.
  - *Example*: instead of querying `how to write custom route in Nuxt`, use `Here is a custom route definition in Nuxt 3:`
- **Natural language**: Frame queries as statements of fact or code snippets.
- **Tools**:
  - `web_search_exa`: To search for links.
  - `web_fetch_exa`: To fetch clean Markdown content from a specific URL.

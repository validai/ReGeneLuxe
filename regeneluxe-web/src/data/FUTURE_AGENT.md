# Future ReGeneLuxe agent

This file documents how a later intelligence layer should consume campaign data. There is no AI provider in this version.

## Source of truth

Call `buildCampaignContext(campaign, accounts)` from `campaignContext.js`.

That function returns one normalized object. Do not ask a model to parse raw intake text first.

## What the context already answers

- What is being promoted: `promotedContent`
- Why: `purpose` / `purposeValues`
- To whom: `audience`
- Where: `accounts`, `platformTargets`
- How: `contentFormats`, `strategy`, `creativeDirection`
- With what assets: `availableAssets`, `assets`
- Tone and constraints: `creativeDirection`, `constraints`
- What success means: `successSignals`
- What is being tested: `testing`
- Current work area: `currentArea` (human) and `currentSection` (enum)

## Readiness first

Call `diagnoseCampaignContext(campaign, accounts)` before generating anything.

If `ready` is false, ask about the `missing` keys instead of inventing a plan.

Useful questions:

- What information is missing?
- What content should be created next?
- Which account is most appropriate?
- What hypothesis is being tested?
- What result changed?
- What should we repeat?
- What should we stop doing?

## Do not implement yet

No OpenAI, Anthropic, Gemini, local LLM, API keys, or agent framework belongs in this repository until the operator is already producing reliable structured context.

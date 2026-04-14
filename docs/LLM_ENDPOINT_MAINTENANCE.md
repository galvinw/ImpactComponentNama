# LLM Endpoint Maintenance Guide

This document explains how the shopper-profiling LLM endpoint is wired today, what assumptions it makes, and exactly where to change it when the provider or payload format changes.

## Scope

This guide covers the server-side adapter used by:
- `POST /api/person-session`
- [server/llmClient.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/llmClient.js)

It does not cover frontend webcam capture logic or product-ranking logic.

## Current Flow

1. The analytics page captures a stable still image for one shopper.
2. The frontend calls `POST /api/person-session` with:
   - `personSessionId`
   - `captureImage`
   - `captureMetadata`
3. [server/index.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/index.js) calls `generateRetailProfile(...)`.
4. [server/llmClient.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/llmClient.js) sends a request to the configured LLM endpoint.
5. The response is parsed and validated into:
   - `stats`
   - `summary`
6. The server ranks products against those stats and stores the accepted session.

## Files To Modify

### Main adapter

- [server/llmClient.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/llmClient.js)

This is the only file that knows:
- which environment variables configure the model
- the exact request body sent to the provider
- the exact response envelope expected back
- the validation rules for accepted LLM output

### API route using the adapter

- [server/index.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/index.js)

Change this only if:
- the route contract itself changes
- the error policy changes
- more metadata needs to be sent into the adapter

### Product-stat schema source of truth

- [server/defaultProducts.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/defaultProducts.js)

The `attributeKeys` array is the canonical list of required retail variables. If you add, rename, or remove a variable here, you must also update:
- the prompt in `server/llmClient.js`
- response validation in `server/llmClient.js`
- any downstream ranking or UI display code that reads product stats

## Environment Variables

### Required

- `LLM_ENDPOINT`
  - Full URL to a chat-completions endpoint.
  - Example: `http://127.0.0.1:1234/v1/chat/completions`
- `LLM_MODEL`
  - Model name the endpoint expects.

### Optional

- `LLM_API_KEY`
  - Only needed if the target endpoint requires bearer auth.

### Legacy fallback

- `LLM_API_URL`
  - Still supported for compatibility.
  - New configuration should prefer `LLM_ENDPOINT`.

## Current Endpoint Assumptions

The adapter currently assumes an OpenAI-compatible chat completions API.

### Request assumptions

- HTTP method: `POST`
- Content type: `application/json`
- Request body contains:
  - `model`
  - `messages`
  - `temperature`
  - `response_format`
- The image is sent in the user message as:

```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/jpeg;base64,..."
  }
}
```

### Response assumptions

The adapter expects the returned content at:

```json
payload.choices[0].message.content
```

That content can be either:
- a plain string containing JSON
- an array of content blocks with text segments

The adapter then strips code fences, extracts the first JSON object, and validates it.

## Required LLM Output Contract

The adapter requires the LLM to return:

```json
{
  "stats": {
    "hydration": 0,
    "energy": 0,
    "sweetness": 0,
    "protein": 0,
    "comfort": 0,
    "focus": 0,
    "urgency": 0,
    "temperature": 0,
    "indulgence": 0,
    "wellness": 0
  },
  "summary": "Retail-facing explanation"
}
```

Validation rules:
- every key in `attributeKeys` must exist
- every stat value must be numeric
- values are clamped to `0..10`
- `summary` must be a non-empty string

If validation fails, `/api/person-session` returns an error and the shopper session is not accepted.

## Most Common Future Changes

### 1. Switch to a different OpenAI-compatible local server

Usually no code change is required. Change only:
- `LLM_ENDPOINT`
- `LLM_MODEL`
- optionally `LLM_API_KEY`

Examples:

```bash
export LLM_ENDPOINT="http://127.0.0.1:1234/v1/chat/completions"
export LLM_MODEL="qwen2.5-vl-7b-instruct"
```

```bash
export LLM_ENDPOINT="http://127.0.0.1:8000/v1/chat/completions"
export LLM_MODEL="llava"
```

### 2. Provider requires a different image format

Modify the `messages` block in [server/llmClient.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/llmClient.js).

Current image shape:

```js
{
  type: 'image_url',
  image_url: { url: captureImage },
}
```

If the provider expects something else, keep the rest of the module unchanged and only adapt this message payload.

### 3. Provider does not support `response_format`

Remove or conditionalize:

```js
response_format: { type: 'json_object' }
```

The parser will still attempt to extract JSON from text, so many providers will work without further changes.

### 4. Provider returns a different response envelope

Update this line in [server/llmClient.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/llmClient.js):

```js
const content = payload?.choices?.[0]?.message?.content;
```

Map the provider-specific response into a raw text payload there. Do not spread response-shape logic through the rest of the app.

### 5. Change the retail variables

Update:
- `attributeKeys` in [server/defaultProducts.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/defaultProducts.js)
- the prompt text in [server/llmClient.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/llmClient.js)
- validation logic in `validateStats`
- any UI or ranking logic that displays or scores those variables

This is a schema change, not just a prompt change.

### 6. Add retries, timeout, or fallback providers

The right place is [server/llmClient.js](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/server/llmClient.js), inside or around `generateRetailProfile(...)`.

Recommended pattern:
- keep one exported function
- isolate provider retries inside that function
- preserve the final return shape:
  - `label`
  - `stats`
  - `summary`

That way, `server/index.js` stays unchanged.

## How To Test Endpoint Changes

### 1. Start the server with explicit endpoint settings

```bash
export LLM_ENDPOINT="http://127.0.0.1:1234/v1/chat/completions"
export LLM_MODEL="qwen2.5-vl-7b-instruct"
npm run server
```

### 2. Verify the API still boots

```bash
curl http://127.0.0.1:3030/health
```

### 3. Trigger a person session manually

Use a small test image as a data URL and call:

```bash
curl -X POST http://127.0.0.1:3030/api/person-session \
  -H 'Content-Type: application/json' \
  -d '{
    "personSessionId": "test-session-1",
    "captureImage": "data:image/jpeg;base64,...",
    "captureMetadata": {
      "brightness": 0.72,
      "sharpness": 0.65
    }
  }'
```

Success means:
- the endpoint responded
- the JSON contract validated
- product ranking completed
- the active shopper session was saved

### 4. Check the stored active session

```bash
curl http://127.0.0.1:3030/api/person-session/active
```

## Troubleshooting

### Error: `Missing LLM_ENDPOINT or LLM_MODEL`

Set:
- `LLM_ENDPOINT`
- `LLM_MODEL`

### Error: `LLM request failed with status ...`

Likely causes:
- wrong port or path
- local model server not running
- model name not loaded on the provider
- provider rejected the image format
- provider required auth but `LLM_API_KEY` was not set

### Error: `LLM response did not contain a JSON object`

The model responded with prose or reasoning instead of strict JSON. Fix one or more of:
- stronger system prompt
- provider-side JSON mode
- `response_format`
- lower temperature

### Error: `LLM response missing numeric value for ...`

The model returned malformed schema. Confirm:
- all 10 stat keys are present
- values are numbers, not strings

## Modification Rules

When changing the endpoint adapter:
- keep request-shape logic inside `server/llmClient.js`
- keep route-shape logic inside `server/index.js`
- keep retail-variable schema changes coordinated with `server/defaultProducts.js`
- avoid leaking provider-specific assumptions into frontend code

That separation is what keeps future provider swaps cheap.

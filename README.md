# Impact Self-supervised AI Kiosk

Two-page retail kiosk application with:
- a full-screen kiosk recommendation view
- an analytics view driven by webcam capture, Human face/body detection, and server-backed product state
- a server-side shopper profiling step that can call a local LLM through an OpenAI-compatible endpoint

## Ports

- Frontend dev server: `http://127.0.0.1:5180`
- API server: `http://127.0.0.1:3030`

## Run The Project

Use a current Node version. The repository includes `.nvmrc`.

```bash
nvm use
npm install
npm run server
```

In a second shell:

```bash
nvm use
npm run dev
```

## Local LLM Setup

The API server does not need a cloud-only SDK. It posts directly to an OpenAI-compatible chat completions endpoint, which means you can point it at a local model server.

Required server environment variables:

```bash
export LLM_ENDPOINT="http://127.0.0.1:1234/v1/chat/completions"
export LLM_MODEL="your-vision-model"
```

Optional:

```bash
export LLM_API_KEY="not-needed-for-most-local-servers"
```

Notes:
- `LLM_ENDPOINT` must be a full chat-completions URL, not just a host name.
- The target model must support image input via the OpenAI-style `image_url` message format.
- `LLM_API_KEY` is optional and only sent when present, so local no-auth servers work.
- `LLM_API_URL` is still accepted as a legacy fallback, but `LLM_ENDPOINT` is the preferred variable.

Example with LM Studio:

```bash
export LLM_ENDPOINT="http://127.0.0.1:1234/v1/chat/completions"
export LLM_MODEL="qwen2.5-vl-7b-instruct"
npm run server
```

Example with another OpenAI-compatible local gateway:

```bash
export LLM_ENDPOINT="http://127.0.0.1:8000/v1/chat/completions"
export LLM_MODEL="llava"
npm run server
```

## What The LLM Must Return

When `/api/person-session` is called, the server sends the accepted shopper still image and expects strict JSON back:

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
  "summary": "Concise retail-facing summary"
}
```

Rules enforced by the server:
- all 10 stat keys must be present
- each stat must be numeric
- values are clamped to the `0..10` range
- `summary` must be a non-empty string

If the endpoint returns invalid JSON or an incompatible schema, the capture is held and the person session is not accepted.

## Main API Endpoints

- `GET /health`
- `GET /api/products`
- `GET /api/person-session/active`
- `POST /api/person-session`
- `POST /api/recommendation-action`
- `POST /api/products/reset`

Full request and response examples are in [API_DOCUMENTATION.md](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/API_DOCUMENTATION.md).

For endpoint maintenance, provider swaps, and request/response adapter changes, use [docs/LLM_ENDPOINT_MAINTENANCE.md](/Users/galvinwidjaja/code/cursor/ImpactComponentNama/docs/LLM_ENDPOINT_MAINTENANCE.md).

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

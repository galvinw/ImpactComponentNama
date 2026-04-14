# API Documentation

This project runs a local API server on `http://127.0.0.1:3030`.

The API has three responsibilities:
- hold canonical product state on the server
- accept one shopper capture per stable person session
- call a configurable LLM endpoint to generate the 10 retail variables and shopper summary

## Server Startup

```bash
nvm use
npm install
npm run server
```

Default port:

```bash
PORT=3030
```

## LLM Endpoint Configuration

The shopper profiling flow uses a generic OpenAI-compatible chat completions endpoint.

Required variables:

```bash
export LLM_ENDPOINT="http://127.0.0.1:1234/v1/chat/completions"
export LLM_MODEL="your-vision-model"
```

Optional:

```bash
export LLM_API_KEY="optional"
```

Behavior:
- `LLM_ENDPOINT` is the preferred variable.
- `LLM_API_URL` is accepted as a legacy fallback.
- The server only sends the `Authorization` header if `LLM_API_KEY` is set.
- The model must support image input because `/api/person-session` sends the accepted still capture as an OpenAI-style `image_url`.

Example local setup with LM Studio:

```bash
export LLM_ENDPOINT="http://127.0.0.1:1234/v1/chat/completions"
export LLM_MODEL="qwen2.5-vl-7b-instruct"
npm run server
```

If the LLM returns invalid JSON or omits any required stat key, the capture stays unaccepted and the API returns an error.

## Health Check

### `GET /health`

Response:

```json
{
  "status": "ok",
  "message": "API server is running"
}
```

## Product State

Products are stored in `server/data/products.json` after first startup.

Each product contains:
- immutable startup values in `defaultStats`
- current mutable values in `stats`

These current values are what recommendation ranking uses.

### `GET /api/products`

Returns the full current catalog.

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "bottled-water",
      "name": "Bottled Water",
      "price": 10,
      "image": "https://...",
      "stats": {
        "hydration": 10,
        "energy": 1,
        "sweetness": 1,
        "protein": 1,
        "comfort": 6,
        "focus": 5,
        "urgency": 9,
        "temperature": 10,
        "indulgence": 2,
        "wellness": 10
      },
      "defaultStats": {
        "hydration": 10,
        "energy": 1,
        "sweetness": 1,
        "protein": 1,
        "comfort": 6,
        "focus": 5,
        "urgency": 9,
        "temperature": 10,
        "indulgence": 2,
        "wellness": 10
      }
    }
  ]
}
```

### `POST /api/products/reset`

Resets all products back to their startup `defaultStats`.

Response:

```json
{
  "success": true,
  "data": {
    "products": [],
    "session": null
  }
}
```

If an active shopper session exists, the API also recomputes the active recommendation and `topProductIds` for that session using the reset products.

## Shopper Session Flow

The analytics page captures a still image only after:
- a person remains present long enough to satisfy stable-lock rules
- lighting, sharpness, size, and centering checks pass

The accepted still capture is then sent to the API, which calls the configured LLM endpoint.

### `GET /api/person-session/active`

Returns the most recently accepted shopper session, or `null`.

Response:

```json
{
  "success": true,
  "data": {
    "id": "person-1712784000000",
    "label": "Visitor 4A2C",
    "captureImage": "data:image/jpeg;base64,...",
    "stats": {
      "hydration": 8.2,
      "energy": 5.4,
      "sweetness": 4.7,
      "protein": 2.1,
      "comfort": 6.5,
      "focus": 5.8,
      "urgency": 6.9,
      "temperature": 8.4,
      "indulgence": 3.9,
      "wellness": 7.2
    },
    "summary": "Visitor appears ready for something cold, steady, and uncomplicated.",
    "activeProductId": "bottled-water",
    "topProductIds": [
      "bottled-water",
      "powerade",
      "ocha-green-tea",
      "orange-juice",
      "iced-coffee"
    ],
    "createdAt": "2026-04-10T18:20:00.000Z",
    "updatedAt": "2026-04-10T18:20:00.000Z"
  }
}
```

### `POST /api/person-session`

Creates or replaces the active shopper session from a stable accepted still capture.

Request:

```json
{
  "personSessionId": "person-1712784000000",
  "captureImage": "data:image/jpeg;base64,...",
  "captureMetadata": {
    "brightness": 0.71,
    "sharpness": 0.62,
    "faceConfidence": 0.96,
    "bodyConfidence": 0.98,
    "faceAreaRatio": 0.14,
    "personStableForMs": 1710
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "person-1712784000000",
      "label": "Visitor 4A2C",
      "captureImage": "data:image/jpeg;base64,...",
      "stats": {
        "hydration": 8.2,
        "energy": 5.4,
        "sweetness": 4.7,
        "protein": 2.1,
        "comfort": 6.5,
        "focus": 5.8,
        "urgency": 6.9,
        "temperature": 8.4,
        "indulgence": 3.9,
        "wellness": 7.2
      },
      "summary": "Visitor appears ready for something cold, steady, and uncomplicated.",
      "activeProductId": "bottled-water",
      "topProductIds": [
        "bottled-water",
        "powerade",
        "ocha-green-tea",
        "orange-juice",
        "iced-coffee"
      ],
      "createdAt": "2026-04-10T18:20:00.000Z",
      "updatedAt": "2026-04-10T18:20:00.000Z"
    },
    "activeRecommendationId": "bottled-water",
    "topProductIds": [
      "bottled-water",
      "powerade",
      "ocha-green-tea",
      "orange-juice",
      "iced-coffee"
    ]
  }
}
```

Failure cases:
- `400` if `personSessionId` or `captureImage` is missing
- `502` if the LLM endpoint is unavailable or returns invalid output
- `500` if no products are available for ranking

## Recommendation Actions

Recommendation actions mutate server product state and keep the kiosk and analytics pages in sync.

### `POST /api/recommendation-action`

Request:

```json
{
  "personSessionId": "person-1712784000000",
  "actionType": "buy",
  "productId": "bottled-water"
}
```

Allowed `actionType` values:
- `buy`
- `skip`
- `select`

Behavior:
- `buy`: moves the selected product closer to the current shopper profile
- `skip`: moves the selected product away from the current shopper profile
- `select`: keeps product stats unchanged and only changes the active recommendation

Response:

```json
{
  "success": true,
  "data": {
    "products": [],
    "session": {
      "id": "person-1712784000000",
      "label": "Visitor 4A2C",
      "captureImage": "data:image/jpeg;base64,...",
      "stats": {
        "hydration": 8.2,
        "energy": 5.4,
        "sweetness": 4.7,
        "protein": 2.1,
        "comfort": 6.5,
        "focus": 5.8,
        "urgency": 6.9,
        "temperature": 8.4,
        "indulgence": 3.9,
        "wellness": 7.2
      },
      "summary": "Visitor appears ready for something cold, steady, and uncomplicated.",
      "activeProductId": "powerade",
      "topProductIds": [
        "powerade",
        "bottled-water",
        "ocha-green-tea",
        "orange-juice",
        "iced-coffee"
      ],
      "createdAt": "2026-04-10T18:20:00.000Z",
      "updatedAt": "2026-04-10T18:21:04.000Z"
    },
    "activeRecommendationId": "powerade",
    "topProductIds": [
      "powerade",
      "bottled-water",
      "ocha-green-tea",
      "orange-juice",
      "iced-coffee"
    ],
    "interactionLogEntry": {
      "id": "1712784064000-buy",
      "time": "06:21:04 PM",
      "action": "buy",
      "recommended": "Bottled Water",
      "notRecommended": "Snickers, Red Bull",
      "stateUpdate": "hydration +0.12, temperature +0.10, urgency -0.08, wellness +0.07",
      "matchDistance": "0.18"
    }
  }
}
```

Failure cases:
- `400` if required fields are missing or `actionType` is invalid
- `404` if the active shopper session or requested product cannot be found
- `500` if the next recommendation cannot be computed

## Legacy Endpoints

These endpoints still exist for older analysis flows:
- `POST /api/update-analysis`
- `GET /api/analyses`
- `POST /api/record-timestamp`
- `GET /api/timestamps`
- `GET /api/camera-feeds`

They are not part of the new shopper-session recommendation loop.

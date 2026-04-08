import { attributeKeys } from './defaultProducts.js';

const attributeDescriptions = {
  hydration: 'need for hydration and refreshment',
  energy: 'need for stimulation or boost',
  sweetness: 'preference for sweet flavor profile',
  protein: 'need for more substantial nutritional density',
  comfort: 'preference for familiar and comforting options',
  focus: 'need for clarity and concentration support',
  urgency: 'likelihood of choosing a quick grab-and-go item',
  temperature: 'preference for colder beverages',
  indulgence: 'desire for reward or treat-like choices',
  wellness: 'preference for lighter, healthier-feeling options',
};

function extractTextContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        if (entry?.type === 'text' && typeof entry.text === 'string') {
          return entry.text;
        }

        return '';
      })
      .join('\n');
  }

  return '';
}

function extractJsonPayload(text) {
  const normalized = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  const firstBraceIndex = normalized.indexOf('{');
  const lastBraceIndex = normalized.lastIndexOf('}');

  if (firstBraceIndex < 0 || lastBraceIndex < 0) {
    throw new Error('LLM response did not contain a JSON object.');
  }

  return JSON.parse(normalized.slice(firstBraceIndex, lastBraceIndex + 1));
}

function validateStats(stats) {
  if (!stats || typeof stats !== 'object') {
    throw new Error('LLM response missing stats object.');
  }

  for (const key of attributeKeys) {
    const value = stats[key];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error(`LLM response missing numeric value for ${key}.`);
    }
  }

  return Object.fromEntries(
    attributeKeys.map((key) => [key, Math.min(10, Math.max(0, Number(stats[key].toFixed(2))))])
  );
}

export async function generateRetailProfile({ captureImage, captureMetadata, personSessionId }) {
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  const apiUrl = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';

  if (!apiKey || !model) {
    throw new Error('Missing LLM_API_KEY or LLM_MODEL for person profiling.');
  }

  const prompt = `Analyze this single retail kiosk shopper image and return a strict JSON object.

Required JSON shape:
{
  "stats": {
    "hydration": number,
    "energy": number,
    "sweetness": number,
    "protein": number,
    "comfort": number,
    "focus": number,
    "urgency": number,
    "temperature": number,
    "indulgence": number,
    "wellness": number
  },
  "summary": "string"
}

Rules:
- Every stat must be a number from 0 to 10.
- Use the image only.
- The summary must be retail-facing, concise, and written as a human-readable explanation of the shopper state for downstream recommendation copy.
- Do not include markdown or code fences.
- Do not include any fields other than stats and summary.

Stat definitions:
${attributeKeys.map((key) => `- ${key}: ${attributeDescriptions[key]}`).join('\n')}

Capture metadata:
${JSON.stringify(captureMetadata, null, 2)}

Session id: ${personSessionId}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a retail profiling model. Return only valid JSON for downstream parsing.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: captureImage } },
          ],
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const parsed = extractJsonPayload(extractTextContent(content));
  const stats = validateStats(parsed.stats);

  if (typeof parsed.summary !== 'string' || parsed.summary.trim().length === 0) {
    throw new Error('LLM response missing summary text.');
  }

  return {
    label: `Visitor ${personSessionId.slice(-4).toUpperCase()}`,
    stats,
    summary: parsed.summary.trim(),
  };
}

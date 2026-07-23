import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Ordered list of free models to try — if one is rate-limited, we try the next
const FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-coder:free',
];

/**
 * Try a single model — returns { content, usage } or throws on non-retryable error
 * Returns null if rate-limited (429) so caller can try next model
 */
async function tryModel(model, messages, maxTokens) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://skill2hire.vercel.app',
      'X-Title': 'Skill2Hire AI Tutor',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (response.status === 429 || response.status === 503) {
    console.warn(`Model ${model} rate-limited (${response.status}), trying next...`);
    return null; // signal to try next model
  }

  if (!response.ok) {
    const errText = await response.text();
    // 400 = invalid model ID — also try next
    if (response.status === 400) {
      console.warn(`Model ${model} returned 400, trying next...`);
      return null;
    }
    throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return { content, usage: data.usage };
}

/**
 * Non-streaming chat completion — tries each free model until one succeeds
 */
export async function chat(messages, userId, feature, db) {
  if (!API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured. Please add it to your environment variables or Vercel project settings.');
  }

  let lastError = null;
  for (const model of FREE_MODELS) {
    try {
      const result = await tryModel(model, messages, 1500);
      if (result === null) continue; // rate-limited, try next

      // Track token usage
      if (result.usage && db && userId) {
        try {
          db.prepare(`
            INSERT INTO token_usage (user_id, feature, prompt_tokens, completion_tokens, total_tokens)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            userId,
            feature || 'unknown',
            result.usage.prompt_tokens || 0,
            result.usage.completion_tokens || 0,
            result.usage.total_tokens || (result.usage.prompt_tokens || 0) + (result.usage.completion_tokens || 0)
          );
        } catch (e) {
          console.error('Token tracking error:', e.message);
        }
      }

      console.log(`✓ Used model: ${model}`);
      return result;
    } catch (err) {
      lastError = err;
      console.error(`Model ${model} failed:`, err.message);
    }
  }

  throw lastError || new Error('All AI models are currently unavailable. Please try again in a moment.');
}


/**
 * Streaming chat completion — sends SSE chunks to Express response
 */
export async function streamChat(messages, res, userId, feature, db) {
  if (!API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured. Please add it to your environment variables or Vercel project settings.');
  }

  let response = null;
  let chosenModel = null;

  for (const model of FREE_MODELS) {
    const r = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://skill2hire.vercel.app',
        'X-Title': 'Skill2Hire AI Tutor',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (r.status === 429 || r.status === 503 || r.status === 400) {
      console.warn(`streamChat: model ${model} returned ${r.status}, trying next...`);
      continue;
    }

    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`OpenRouter API error ${r.status}: ${errText}`);
    }

    response = r;
    chosenModel = model;
    break;
  }

  if (!response) {
    throw new Error('All AI models are currently rate-limited. Please try again in a moment.');
  }

  console.log(`✓ streamChat using model: ${chosenModel}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let usageData = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
            if (parsed.usage) {
              usageData = parsed.usage;
            }
          } catch (e) {
            // skip malformed chunks
          }
        }
      }
    }
  } catch (e) {
    console.error('Stream error:', e.message);
  }

  // Track token usage
  if (usageData && db && userId) {
    try {
      db.prepare(`
        INSERT INTO token_usage (user_id, feature, prompt_tokens, completion_tokens, total_tokens)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        feature || 'unknown',
        usageData.prompt_tokens || 0,
        usageData.completion_tokens || 0,
        usageData.total_tokens || 0
      );
    } catch (e) {
      console.error('Token tracking error:', e.message);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true, fullContent, usage: usageData })}\n\n`);
  res.end();

  return { content: fullContent, usage: usageData };
}


/**
 * Parse JSON from LLM response — handles markdown code blocks
 */
export function parseJSON(text) {
  let cleaned = text.trim();
  // Remove thinking blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');
  cleaned = cleaned.trim();
  // Remove markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  // Try parsing
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to extract JSON array or object
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0].replace(/,\s*([\]}])/g, '$1')); } catch {}
    }
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0].replace(/,\s*([\]}])/g, '$1')); } catch {}
    }
    throw new Error('Failed to parse LLM JSON response');
  }
}

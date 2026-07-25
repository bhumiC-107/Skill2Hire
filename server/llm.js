import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS_URL = 'https://openrouter.ai/api/v1/models';

// Primary list of active free models on OpenRouter
const STATIC_FREE_MODELS = [
  'inclusionai/ling-3.0-flash:free',
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openai/gpt-oss-20b:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'poolside/laguna-xs-2.1:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

let dynamicFreeModelsCache = null;
let lastCacheFetchTime = 0;

/**
 * Dynamically fetch active free models from OpenRouter if static list fails
 */
async function getActiveFreeModels() {
  const now = Date.now();
  // Cache for 10 minutes
  if (dynamicFreeModelsCache && (now - lastCacheFetchTime < 600000)) {
    return dynamicFreeModelsCache;
  }

  try {
    const res = await fetch(MODELS_URL);
    if (res.ok) {
      const data = await res.json();
      const liveFree = (data.data || [])
        .filter(m => m.id && m.id.endsWith(':free'))
        .map(m => m.id);

      if (liveFree.length > 0) {
        // Merge static list with live free models (putting static working ones first)
        const combined = [...new Set([...STATIC_FREE_MODELS, ...liveFree])];
        dynamicFreeModelsCache = combined;
        lastCacheFetchTime = now;
        return combined;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch dynamic OpenRouter models list:', err.message);
  }

  return STATIC_FREE_MODELS;
}

/**
 * Sanitize message content for non-multimodal models if array format is rejected
 */
function normalizeMessages(messages, textOnly = false) {
  if (!textOnly) return messages;

  return messages.map(msg => {
    if (Array.isArray(msg.content)) {
      const textParts = msg.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
      return { ...msg, content: textParts || 'User provided context' };
    }
    return msg;
  });
}

/**
 * Try a single model — returns { content, usage } or null on retryable error
 */
async function tryModel(model, messages, maxTokens, isTextOnlyRetry = false) {
  const finalMessages = normalizeMessages(messages, isTextOnlyRetry);

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
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (response.status === 429 || response.status === 503) {
    console.warn(`Model ${model} rate-limited (${response.status}), trying next...`);
    return null;
  }

  if (!response.ok) {
    const errText = await response.text();
    // 400 = invalid model ID or invalid request payload
    if (response.status === 400 || response.status === 404) {
      if (!isTextOnlyRetry && messages.some(m => Array.isArray(m.content))) {
        // Retry with text-only payload if content contained image array
        return tryModel(model, messages, maxTokens, true);
      }
      console.warn(`Model ${model} returned ${response.status}, trying next...`);
      return null;
    }
    throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return { content, usage: data.usage };
}

/**
 * Non-streaming chat completion — tries free models until one succeeds
 */
export async function chat(messages, userId, feature, db) {
  if (!API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured. Please add it to your environment variables or Vercel project settings.');
  }

  const freeModels = await getActiveFreeModels();
  let lastError = null;

  for (const model of freeModels) {
    try {
      const result = await tryModel(model, messages, 3500);
      if (result === null) continue;

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

  const freeModels = await getActiveFreeModels();
  let response = null;
  let chosenModel = null;

  for (const model of freeModels) {
    try {
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

      if (r.status === 429 || r.status === 503 || r.status === 400 || r.status === 404) {
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
    } catch (err) {
      console.warn(`streamChat: model ${model} fetch failed (${err.message}), trying next...`);
    }
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
 * Parse JSON from LLM response — resiliently handles markdown code blocks, thinking tags, trailing commas, and partial JSON truncation
 */
export function parseJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Failed to parse LLM JSON response: empty content');
  }

  let cleaned = text.trim();
  // 1. Remove thinking blocks (<think>...</think>)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Remove markdown code fences anywhere in text
  cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

  // 3. Remove non-JSON preambles or postambles if brackets exist
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  const cleanString = (str) => str
    .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' '); // remove illegal control chars

  // Try direct parse
  try {
    return JSON.parse(cleanString(cleaned));
  } catch (e) {
    // Try array slice if array brackets present
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const arrCandidate = cleaned.slice(firstBracket, lastBracket + 1);
      try {
        return JSON.parse(cleanString(arrCandidate));
      } catch (err) {}
    }

    // Try object slice if object braces present
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const objCandidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(cleanString(objCandidate));
      } catch (err) {}
    }

    // Handle truncated JSON array (missing closing ])
    if (firstBracket !== -1) {
      const partialArr = cleaned.slice(firstBracket);
      const objects = [];
      const objRegex = /\{[\s\S]*?\}(?=\s*,|\s*\]|\s*$)/g;
      let match;
      while ((match = objRegex.exec(partialArr)) !== null) {
        try {
          objects.push(JSON.parse(cleanString(match[0])));
        } catch (err) {}
      }
      if (objects.length > 0) {
        return objects;
      }
    }

    // Handle truncated JSON object (missing closing })
    if (firstBrace !== -1) {
      let partialObj = cleaned.slice(firstBrace);
      let openBraces = (partialObj.match(/\{/g) || []).length;
      let closeBraces = (partialObj.match(/\}/g) || []).length;
      while (openBraces > closeBraces) {
        partialObj += '}';
        closeBraces++;
      }
      try {
        return JSON.parse(cleanString(partialObj));
      } catch (err) {}
    }

    throw new Error('Failed to parse LLM JSON response');
  }
}


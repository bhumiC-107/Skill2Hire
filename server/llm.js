import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.0-flash-001';

/**
 * Non-streaming chat completion — returns parsed JSON or text
 */
export async function chat(messages, userId, feature, db) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Skill2Hire AI Tutor',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Track token usage
  if (data.usage && db && userId) {
    try {
      db.prepare(`
        INSERT INTO token_usage (user_id, feature, prompt_tokens, completion_tokens, total_tokens)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        feature || 'unknown',
        data.usage.prompt_tokens || 0,
        data.usage.completion_tokens || 0,
        data.usage.total_tokens || (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0)
      );
    } catch (e) {
      console.error('Token tracking error:', e.message);
    }
  }

  const content = data.choices?.[0]?.message?.content || '';
  return { content, usage: data.usage };
}

/**
 * Streaming chat completion — sends SSE chunks to Express response
 */
export async function streamChat(messages, res, userId, feature, db) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Skill2Hire AI Tutor',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2500,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
  }

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

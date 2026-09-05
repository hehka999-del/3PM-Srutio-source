const config = require('./config');
const { guild } = require('./db');

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const history = new Map();
const cooldownUntil = [0, 0, 0];
let cursor = 0;

function keyFor(guildId, channelId) { return `${guildId}:${channelId}`; }

function getHistory(guildId, channelId) { return history.get(keyFor(guildId, channelId)) || []; }

function addHistory(guildId, channelId, role, content) {
  const key = keyFor(guildId, channelId);
  const list = getHistory(guildId, channelId);
  list.push({ role, content: String(content).slice(0, 1800) });
  while (list.length > 8) list.shift();
  history.set(key, list);
}

function promptFor(server, language = 'en') {
  const a = guild(server.id).ai;
  const languageRule = language === 'en'
    ? 'Answer in English.'
    : `Reply primarily in the user's selected language (${language}).`;
  return [
    `You are the AI assistant for the Discord server "${server.name}" inside 3PM Studio.`,
    'Never claim to have performed a Discord action unless the bot actually did it.',
    'For moderation, provide recommendations only unless a separate trusted command performs the action.',
    languageRule,
    a.role && `Role: ${a.role}`,
    a.skills && `Capabilities: ${a.skills}`,
    a.systemRules && `Permanent rules: ${a.systemRules}`,
    a.style && `Communication style: ${a.style}`
  ].filter(Boolean).join('\n\n').slice(0, 9000);
}

async function chat(server, userId, prompt, channelId, options = {}) {
  if (!config.groqKeys.length) throw new Error('No GROQ_API_KEY_1/2/3 configured.');

  const language = guild(server.id).userLanguages[userId] || guild(server.id).language || 'en';
  const messages = [
    { role: 'system', content: promptFor(server, language) },
    ...getHistory(server.id, channelId),
    { role: 'user', content: String(prompt).slice(0, 4000) }
  ];

  let lastError = null;
  for (let attempt = 0; attempt < config.groqKeys.length; attempt++) {
    const idx = (cursor + attempt) % config.groqKeys.length;
    if (cooldownUntil[idx] > Date.now()) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.groqKeys[idx]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.groqModels[idx] || config.groqModels[0],
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 700
        }),
        signal: controller.signal
      });
      const raw = await res.text();
      let data = {};
      try { data = JSON.parse(raw); } catch {}
      cursor = (idx + 1) % config.groqKeys.length;
      if (res.status === 429) {
        cooldownUntil[idx] = Date.now() + 7000;
        lastError = new Error('Groq rate limit reached.');
        continue;
      }
      if (res.status >= 500) {
        cooldownUntil[idx] = Date.now() + 4000;
        lastError = new Error(`Groq server error (${res.status}).`);
        continue;
      }
      if (!res.ok) throw new Error(data?.error?.message || `Groq returned HTTP ${res.status}.`);
      const answer = data?.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new Error('Groq returned an empty response.');
      addHistory(server.id, channelId, 'user', prompt);
      addHistory(server.id, channelId, 'assistant', answer);
      return answer;
    } catch (error) {
      lastError = error.name === 'AbortError' ? new Error('AI request timed out after 15 seconds.') : error;
      cooldownUntil[idx] = Date.now() + 2500;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('No Groq key is currently available.');
}

function chunks(text, max = 1900) {
  const result = [];
  let rest = String(text || '').trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < 500) cut = max;
    result.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) result.push(rest);
  return result.slice(0, 4);
}

module.exports = { chat, chunks, promptFor, history };

require('dotenv').config();

const REQUIRED = ['BOT_TOKEN', 'CLIENT_ID'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  version: '6.0.0',
  token: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  ownerId: process.env.OWNER_ID || '',
  groqKeys: [1, 2, 3].map(i => process.env[`GROQ_API_KEY_${i}`] || '').filter(Boolean),
  groqModels: [
    process.env.GROQ_MODEL_1 || 'llama-3.1-8b-instant',
    process.env.GROQ_MODEL_2 || 'openai/gpt-oss-20b',
    process.env.GROQ_MODEL_3 || 'openai/gpt-oss-120b'
  ],
  dataFile: require('path').join(__dirname, '..', 'data.json')
};

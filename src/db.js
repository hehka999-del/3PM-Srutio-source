const fs = require('fs');
const config = require('./config');

function createGuild() {
  return {
    logsChannelId: null,
    welcomeChannelId: null,
    goodbyeChannelId: null,
    ticketCategoryId: null,
    statsCategoryId: null,
    statsChannels: {},
    ticketCounter: 0,
    tickets: {},
    warnings: {},
    cases: [],
    messageStats: {},
    levelBonus: {},
    blockedWords: [],
    filterEnabled: false,
    automod: {
      enabled: false,
      links: false,
      invites: false,
      caps: false,
      mentions: false,
      zalgo: false,
      repeated: false,
      spam: true,
      exemptRoles: [],
      exemptChannels: []
    },
    botGuard: false,
    language: 'en',
    userLanguages: {},
    ai: {
      enabled: false,
      systemRules: '',
      role: '',
      skills: '',
      style: '',
      chatChannelId: null,
      chatMode: 'mention'
    },
    polls: {},
    tableBuilders: {}
  };
}

function load() {
  try {
    if (!fs.existsSync(config.dataFile)) return { guilds: {} };
    const parsed = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
    parsed.guilds ||= {};
    return parsed;
  } catch {
    return { guilds: {} };
  }
}

const db = load();
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(config.dataFile, JSON.stringify(db, null, 2));
    } catch (error) {
      console.error('Database save failed:', error.message);
    }
  }, 500);
}

function guild(id) {
  db.guilds[id] ||= createGuild();
  const g = db.guilds[id];
  const defaults = createGuild();
  for (const [key, value] of Object.entries(defaults)) {
    if (g[key] === undefined) g[key] = value;
  }
  for (const [key, value] of Object.entries(defaults.automod)) {
    if (g.automod[key] === undefined) g.automod[key] = value;
  }
  for (const [key, value] of Object.entries(defaults.ai)) {
    if (g.ai[key] === undefined) g.ai[key] = value;
  }
  return g;
}

function stats(guildId, userId) {
  const g = guild(guildId);
  g.messageStats[userId] ||= { messages: 0 };
  return g.messageStats[userId];
}

module.exports = { db, guild, stats, save, createGuild };

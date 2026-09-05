const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORS = { primary: 0x5865F2, success: 0x57F287, warning: 0xFEE75C, danger: 0xED4245, muted: 0x3A3A3A };

const LANGUAGES = {
  en: '🇺🇸 English',
  ru: '🇷🇺 Russian',
  uk: '🇺🇦 Ukrainian',
  de: '🇩🇪 Deutsch',
  fr: '🇫🇷 Français',
  es: '🇪🇸 Español',
  tr: '🇹🇷 Türkçe',
  pt: '🇵🇹 Português'
};

function embed(title, description = '', color = COLORS.primary) {
  const e = new EmbedBuilder().setColor(color).setTitle(title);
  if (description) e.setDescription(description);
  return e.setTimestamp();
}

function ephemeral(payload = {}) { return { ...payload, ephemeral: true }; }

function languageRows() {
  const entries = Object.entries(LANGUAGES);
  return [
    new ActionRowBuilder().addComponents(...entries.slice(0, 5).map(([id, label]) =>
      new ButtonBuilder().setCustomId(`language:${id}`).setLabel(label).setStyle(ButtonStyle.Secondary)
    )),
    new ActionRowBuilder().addComponents(...entries.slice(5).map(([id, label]) =>
      new ButtonBuilder().setCustomId(`language:${id}`).setLabel(label).setStyle(ButtonStyle.Secondary)
    ))
  ];
}

function topButtons(mode = 'exp') {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('top:exp').setEmoji('🏆').setLabel('Experience').setStyle(mode === 'exp' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('top:messages').setEmoji('💬').setLabel('Messages').setStyle(mode === 'messages' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('top:levels').setEmoji('🎖️').setLabel('Levels').setStyle(mode === 'levels' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  )];
}

module.exports = { COLORS, LANGUAGES, embed, ephemeral, languageRows, topButtons };

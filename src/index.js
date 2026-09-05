const {
  Client, GatewayIntentBits, Partials, REST, Routes,
  PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder
} = require('discord.js');
const { version, token, clientId, ownerId, groqKeys, groqModels } = require('./config');
const { guild, stats, save } = require('./db');
const { COLORS, LANGUAGES, embed, ephemeral, languageRows, topButtons } = require('./ui');
const { commands, adminOnly, modOnly } = require('./commands');
const { chat: aiChat, chunks: aiChunks } = require('./ai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const games = new Map();
const polls = new Map();
const aiReplyCooldown = new Map();

function isAdmin(i) {
  return i.memberPermissions?.has(PermissionFlagsBits.Administrator) || (ownerId && i.user.id === ownerId);
}
function canModerate(i, target) {
  const me = i.guild.members.me;
  return Boolean(me && i.member && target && target.id !== i.guild.ownerId && target.id !== me.id &&
    i.member.roles.highest.position > target.roles.highest.position &&
    me.roles.highest.position > target.roles.highest.position);
}
async function reply(i, payload) {
  try {
    if (i.replied || i.deferred) return i.editReply(payload).catch(()=>{});
    return i.reply(payload).catch(()=>{});
  } catch {}
}
async function defer(i, isPrivate = false) {
  try { await i.deferReply(isPrivate ? {ephemeral:true} : {}); return true; } catch { return false; }
}
function userLanguage(g, userId) { return g.userLanguages[userId] || g.language || 'en'; }
function roleColor(name) {
  return {orange:0xF0A43C,blue:0x5865F2,purple:0x9B59B6,green:0x39B54A,red:0xD64A4A}[name] || 0xF0A43C;
}
function expFor(g, userId) { return (Number(g.messageStats[userId]?.messages)||0) + (Number(g.levelBonus[userId])||0); }
function levelFor(exp) { return Math.floor(exp/300)+1; }
function rankPosition(g, userId) {
  const ids=[...new Set([...Object.keys(g.messageStats),...Object.keys(g.levelBonus)])];
  ids.sort((a,b)=>expFor(g,b)-expFor(g,a));
  const p=ids.indexOf(userId); return p<0?ids.length+1:p+1;
}

async function makeRankCard(i, member, colorName) {
  const { createCanvas, loadImage } = require('@napi-rs/canvas');
  const g=guild(i.guild.id), exp=expFor(g,member.id), level=levelFor(exp), current=exp%300, position=rankPosition(g,member.id);
  const canvas=createCanvas(1100,400),ctx=canvas.getContext('2d');
  const accent=`#${roleColor(colorName).toString(16).padStart(6,'0')}`;
  ctx.fillStyle='#151515';ctx.fillRect(0,0,1100,400);ctx.fillStyle='#232323';ctx.beginPath();ctx.roundRect(18,18,1064,364,30);ctx.fill();
  ctx.fillStyle=accent;ctx.beginPath();ctx.arc(155,200,112,0,Math.PI*2);ctx.fill();
  try{const av=await loadImage(member.user.displayAvatarURL({extension:'png',size:256}));ctx.save();ctx.beginPath();ctx.arc(155,200,98,0,Math.PI*2);ctx.clip();ctx.drawImage(av,57,102,196,196);ctx.restore();}catch{}
  ctx.fillStyle='#fff';ctx.font='bold 44px Sans';ctx.fillText(String(member.displayName||member.user.username).slice(0,25),310,88);
  ctx.fillStyle='#aaa';ctx.font='24px Sans';ctx.fillText(('@'+member.user.username).slice(0,30),310,127);
  ctx.fillStyle=accent;ctx.font='bold 28px Sans';ctx.fillText(memberRank(member).slice(0,24),310,174);
  ctx.fillStyle='#eee';ctx.font='25px Sans';ctx.fillText(`Level ${level}`,310,220);ctx.textAlign='right';ctx.fillText(`Rank #${position}`,980,88);ctx.fillText(`${current} / 300 EXP`,980,220);ctx.textAlign='left';
  ctx.fillStyle='#0f0f0f';ctx.beginPath();ctx.roundRect(310,250,670,42,21);ctx.fill();ctx.fillStyle=accent;ctx.beginPath();ctx.roundRect(310,250,Math.max(7,670*(current/300)),42,21);ctx.fill();
  ctx.fillStyle='#ccc';ctx.font='19px Sans';ctx.fillText(`Next level: ${300-current} EXP`,310,330);ctx.fillText(`Messages: ${g.messageStats[member.id]?.messages||0}`,310,360);ctx.textAlign='right';ctx.fillText(i.guild.name.slice(0,40),980,360);ctx.textAlign='left';
  return canvas.toBuffer('image/png');
}
function memberRank(m){ if(m.permissions.has(PermissionFlagsBits.Administrator))return 'ADMINISTRATOR'; if(m.permissions.has(PermissionFlagsBits.ManageMessages)||m.permissions.has(PermissionFlagsBits.ModerateMembers))return 'MODERATOR'; return 'MEMBER'; }

function topPayload(guildObj, mode='exp') {
  const g=guild(guildObj.id); const ids=[...new Set([...Object.keys(g.messageStats),...Object.keys(g.levelBonus)])];
  ids.sort((a,b)=> mode==='messages' ? (g.messageStats[b]?.messages||0)-(g.messageStats[a]?.messages||0) : mode==='levels' ? levelFor(expFor(g,b))-levelFor(expFor(g,a)) : expFor(g,b)-expFor(g,a));
  const medals=['🥇','🥈','🥉'];
  const lines=ids.slice(0,10).map((id,n)=>{
    const exp=expFor(g,id), lvl=levelFor(exp), msg=g.messageStats[id]?.messages||0;
    return `${medals[n]||'🔹'} **#${n+1}** <@${id}>\n> ${mode==='messages'?`💬 **${msg}** messages`:`${mode==='levels'?'🎖️':'🏆'} **${mode==='levels'?`Level ${lvl}`:`${exp} EXP` }**${mode==='levels'?` • ${exp} EXP`:``}`}`;
  });
  const title = 'Member Leaderboard'; const sub = mode==='messages'?'Sorted by messages 💬':mode==='levels'?'Sorted by level 🎖️':'Sorted by experience 🏆';
  const e=embed(title,`${sub}\n\n${lines.join('\n\n')||'No stats yet.'}`);e.setThumbnail(guildObj.iconURL({size:256})||null);e.setFooter({text:`${guildObj.name} • 3PM Studio`});
  return {embeds:[e],components:topButtons(mode)};
}

function pollPayload(p, finished=false){
  const total=Object.keys(p.voters).length; const blocks=p.options.map((o,n)=>{const c=p.votes[n]||0,pct=total?Math.round(c/total*100):0,filled=Math.round(pct/10);return `**${n+1}. ${o}**\n${'█'.repeat(filled)}${'░'.repeat(10-filled)} **${pct}%** • ${c} votes`;});
  const e=embed(finished?'📊 Poll Results':'📊 Poll',`**${p.question}**\n\n${blocks.join('\n\n')}\n\n${finished?`Total votes: **${total}**`:`Ends <t:${Math.floor(p.endsAt/1000)}:R>`}` ,finished?COLORS.success:COLORS.primary);
  const components=finished?[]:[new ActionRowBuilder().addComponents(...p.options.map((o,n)=>new ButtonBuilder().setCustomId(`poll:${p.id}:${n}`).setLabel(o.slice(0,80)).setStyle(ButtonStyle.Secondary)))];
  return {embeds:[e],components};
}

function tablePreview(state){
  const e=embed(state.title,state.description||'');
  if(state.media&&/^https?:\/\/\S+$/i.test(state.media))e.setImage(state.media);
  if(state.lines.length)e.addFields({name:'Content',value:state.lines.join('\n').slice(0,1024)});
  const rows=[new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('table:addline').setLabel('Add line').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('table:addbutton').setLabel('Add button').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('table:media').setLabel('Add image/GIF').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('table:publish').setLabel('Publish').setStyle(ButtonStyle.Success)
  )];
  rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('table:cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)));
  if(state.buttons.length)e.setFooter({text:`${state.buttons.length}/5 link buttons`});
  rows[0].components[1].setDisabled(state.buttons.length>=5);
  return {embeds:[e],components:rows,ephemeral:true};
}

client.once('ready', async ()=>{
  console.log(`3PM Studio ${version} online as ${client.user.tag}`);
  console.log(`Servers: ${client.guilds.cache.size} | Groq keys: ${groqKeys.length}/3`);
  const rest=new REST({version:'10'}).setToken(token);
  await rest.put(Routes.applicationCommands(clientId),{body:commands});
  for(const gld of client.guilds.cache.values()){
    const g=guild(gld.id);
    if(g.updateAnnounced===version)continue;
    const ch=g.logsChannelId?gld.channels.cache.get(g.logsChannelId):gld.systemChannel;
    if(ch?.isTextBased()){
      await ch.send({embeds:[embed('🚀 3PM Studio','**Global Update 6.0.0**\n\nImproved ranking, AutoMod, tables, polls, AI, languages, moderation stability and administration tools.',COLORS.primary)]}).catch(()=>{});
      g.updateAnnounced=version;save();
    }
  }
});

client.on('guildCreate',async gld=>{
  const ch=gld.systemChannel||gld.channels.cache.find(c=>c.isTextBased());
  if(ch?.isTextBased())await ch.send({embeds:[embed('👋 Welcome to 3PM Studio','Run `/setup` for the basic setup, `/languages` to choose a language, and `/help` for the command list.')],components:languageRows()}).catch(()=>{});
});

client.on('guildMemberAdd',async member=>{
  const g=guild(member.guild.id); if(member.user.bot&&g.botGuard){if(member.kickable)await member.kick('3PM Bot Guard').catch(()=>{});return;} if(!g.welcomeChannelId)return;
  const ch=member.guild.channels.cache.get(g.welcomeChannelId);if(!ch?.isTextBased())return;
  const n=member.guild.memberCount; const e=embed('👋 NEW MEMBER',`${member} joined **${member.guild.name}**.`,COLORS.success).setThumbnail(member.user.displayAvatarURL({size:256})).addFields(
    {name:'Username',value:`\`${member.user.username}\``,inline:true},{name:'Server member #',value:`**${n}**`,inline:true},{name:'Account age',value:`<t:${Math.floor(member.user.createdTimestamp/1000)}:R>`,inline:true},{name:'Joined',value:`<t:${Math.floor((member.joinedTimestamp||Date.now())/1000)}:R>`,inline:true},{name:'ID',value:`\`${member.id}\``,inline:false}
  ); await ch.send({embeds:[e],allowedMentions:{parse:['users']}}).catch(()=>{});
});
client.on('guildMemberRemove',async member=>{const g=guild(member.guild.id);if(!g.goodbyeChannelId)return;const ch=member.guild.channels.cache.get(g.goodbyeChannelId);if(!ch?.isTextBased())return;const e=embed('👋 MEMBER LEFT',`${member.user.tag} left **${member.guild.name}**.`,COLORS.warning).setThumbnail(member.user.displayAvatarURL({size:256})).addFields({name:'Username',value:`\`${member.user.username}\``,inline:true},{name:'Account age',value:`<t:${Math.floor(member.user.createdTimestamp/1000)}:R>`,inline:true},{name:'ID',value:`\`${member.id}\``,inline:true});await ch.send({embeds:[e]}).catch(()=>{});});

client.on('messageCreate',async message=>{
  if(!message.guild||message.author.bot)return; const g=guild(message.guild.id),st=stats(message.guild.id,message.author.id);st.messages++;if(st.messages%10===0)save();
  const exempt=g.automod.exemptChannels.includes(message.channelId)||message.member?.roles.cache.some(r=>g.automod.exemptRoles.includes(r.id));if(exempt)return;
  const text=message.content||'',lower=text.toLowerCase();
  if(g.filterEnabled&&g.blockedWords.some(w=>lower.includes(w.toLowerCase()))){await message.delete().catch(()=>{});return;}
  if(g.automod.enabled&&!message.member?.permissions.has(PermissionFlagsBits.Administrator)){
    const alpha=(text.match(/[A-Za-z]/g)||[]).length,caps=(text.match(/[A-Z]/g)||[]).length;
    const hit=(g.automod.links&&/https?:\/\/\S+/i.test(text))||(g.automod.invites&&/discord\.gg\/|discord\.com\/invite\//i.test(text))||(g.automod.caps&&alpha>=10&&caps/alpha>=.75)||(g.automod.mentions&&message.mentions.users.size+message.mentions.roles.size+(message.mentions.everyone?1:0)>=6)||(g.automod.zalgo&&/[\u0300-\u036f]{5,}/u.test(text))||(g.automod.repeated&&/(.)\1{7,}/u.test(text));
    if(hit){await message.delete().catch(()=>{});return;}
  }
  const a=g.ai;if(a.enabled&&a.chatChannelId===message.channelId){const mentioned=message.mentions.has(client.user)||message.reference;const should=a.chatMode==='all'||mentioned;const last=aiReplyCooldown.get(message.channelId)||0;if(should&&Date.now()-last>=8000&&groqKeys.length){aiReplyCooldown.set(message.channelId,Date.now());void aiChat(message.guild,message.author.id,message.content||`Hello ${message.author.username}`,message.channelId,{temperature:.8,maxTokens:500}).then(ans=>{const parts=aiChunks(ans);for(const p of parts)message.channel.send({embeds:[embed('🤖 3PM AI',p)]}).catch(()=>{});}).catch(()=>{});}}
});

client.on('interactionCreate',async i=>{
  const watchdog=setTimeout(()=>{if(!i.replied&&!i.deferred&&i.isRepliable?.())i.reply(ephemeral({embeds:[embed('⏱️ 3PM Studio','The interaction timed out. Please try again.',COLORS.warning)]})).catch(()=>{});},2200);
  try{
    if(i.isButton()){await handleButton(i);return;}
    if(i.isModalSubmit()){await handleModal(i);return;}
    if(!i.isChatInputCommand())return;
    const name=i.commandName;
    if(adminOnly.has(name)&&!isAdmin(i))return reply(i,ephemeral({embeds:[embed('⛔ Access denied','Administrator permission is required.',COLORS.danger)]}));
    if(modOnly.has(name)&&!i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)&&!i.memberPermissions?.has(PermissionFlagsBits.ManageMessages)&&!isAdmin(i))return reply(i,ephemeral({embeds:[embed('⛔ Access denied','You need a moderation permission.',COLORS.danger)]}));
    const g=guild(i.guild.id);

    // Modal-first commands: NEVER defer before showModal.
    if(name==='ticket'){const modal=new ModalBuilder().setCustomId('ticket_modal').setTitle('Create a ticket');modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('What do you need help with?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)));return i.showModal(modal);}
    if(name==='table'){const modal=new ModalBuilder().setCustomId('table_modal').setTitle('Create a table');modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(3500)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('media').setLabel('Image/GIF URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500)));return i.showModal(modal);}

    if(name==='ai') return reply(i,ephemeral({embeds:[embed('🤖 3PM AI',`AI is configured through the source and environment variables.\n\nKeys: **${groqKeys.length}/3**\nModels: ${groqModels.map(x=>`\`${x}\``).join(', ')}\n\nUse the AI panel section in the public repository to extend this UI.`)]}));
    if(name==='help'){return reply(i,{embeds:[embed('3PM STUDIO • HELP','**User**\n`/ping` `/uptime` `/server` `/user` `/avatar` `/rank` `/top` `/coinflip` `/rps` `/tictactoe` `/poll` `/language` `/languages`\n\n**Support**\n`/ticket` `/report` `/suggest`\n\n**Moderation**\n`/warn` `/unwarn` `/warnings` `/mute` `/unmute` `/timeout` `/untimeout` `/kick` `/ban` `/clear` `/lock` `/unlock` `/slowmode` `/cases` `/warnqueue`\n\n**Administration**\n`/setup` `/settings` `/logs` `/automod` `/filter` `/botguard` `/roles` `/temprole` `/ticket-setup` `/stats-setup` `/table` `/announcement` `/panel` `/ai`') ]});}
    if(name==='ping')return reply(i,{embeds:[embed('🏓 PONG',`${i.client.ws.ping} ms`,COLORS.success)]});
    if(name==='uptime')return reply(i,{embeds:[embed('⏱️ UPTIME',formatUptime(process.uptime()),COLORS.success)]});
    if(name==='server')return reply(i,{embeds:[embed(i.guild.name,`Members: **${i.guild.memberCount}**\nChannels: **${i.guild.channels.cache.size}**\nRoles: **${i.guild.roles.cache.size}**`).setThumbnail(i.guild.iconURL({size:256})||null)]});
    if(name==='user'){const u=i.options.getUser('user')||i.user;const m=await i.guild.members.fetch(u.id).catch(()=>null);return reply(i,{embeds:[embed('USER PROFILE',`${u}`).setThumbnail(u.displayAvatarURL({size:1024})).addFields({name:'Username',value:`\`${u.username}\``,inline:true},{name:'ID',value:`\`${u.id}\``,inline:true},{name:'Account age',value:`<t:${Math.floor(u.createdTimestamp/1000)}:R>`,inline:true},{name:'Joined',value:m?.joinedTimestamp?`<t:${Math.floor(m.joinedTimestamp/1000)}:R>`:'—',inline:true})]});}
    if(name==='avatar'){const u=i.options.getUser('user')||i.user;return reply(i,{embeds:[embed(`AVATAR • ${u.username}`,`${u}`).setImage(u.displayAvatarURL({size:1024,extension:'png'}))]});}
    if(name==='coinflip')return reply(i,{embeds:[embed('🪙 COIN FLIP',Math.random()<.5?'Heads':'Tails',COLORS.success)]});
    if(name==='rps')return reply(i,{embeds:[embed('✊ ROCK • PAPER • SCISSORS','Choose your move:')],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rps:${i.user.id}:rock`).setLabel('Rock 🪨').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId(`rps:${i.user.id}:paper`).setLabel('Paper 📄').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId(`rps:${i.user.id}:scissors`).setLabel('Scissors ✂️').setStyle(ButtonStyle.Secondary))]});
    if(name==='top'){g.topMode='exp';save();return reply(i,topPayload(i.guild,'exp'));}
    if(name==='rank'){const target=i.options.getUser('user')||i.user,add=i.options.getInteger('add_levels')||0;if(add){if(!isAdmin(i))return reply(i,ephemeral({content:'Administrator only.'}));g.levelBonus[target.id]=(g.levelBonus[target.id]||0)+add*300;save();}const m=await i.guild.members.fetch(target.id).catch(()=>null);if(!m)return reply(i,ephemeral({content:'User not found.'}));if(!(await defer(i,false)))return;const png=await makeRankCard(i,m,i.options.getString('color')||'orange');return i.editReply({files:[new AttachmentBuilder(png,{name:'3pm-rank.png'})]});}
    if(name==='poll'){const options=['option1','option2','option3','option4'].map(k=>i.options.getString(k)).filter(Boolean);const minutes=i.options.getInteger('minutes',true);const p={id:`${i.guild.id}:${Date.now()}`,channelId:i.channelId,messageId:null,question:i.options.getString('question',true),options,votes:{},voters:{},endsAt:Date.now()+minutes*60000};const msg=await i.channel.send(pollPayload(p));p.messageId=msg.id;polls.set(p.id,p);setTimeout(()=>finishPoll(p.id),minutes*60000+250);return reply(i,ephemeral({content:'✅ Poll created.'}));}
    if(name==='ticket-setup'){const cat=await i.guild.channels.create({name:'🎫 Tickets',type:ChannelType.GuildCategory,reason:'3PM Studio ticket setup'});g.ticketCategoryId=cat.id;save();return reply(i,ephemeral({embeds:[embed('✅ Ticket system',`Category created: ${cat}`)]}));}
    if(name==='stats-setup'){const modal=new ModalBuilder().setCustomId('stats_modal').setTitle('Statistics setup');for(const [id,label,ph] of [['category','Category','📊 Statistics'],['members','Members','Members'],['bots','Bots','Bots'],['channels','Channels','Channels'],['roles','Roles','Roles']])modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(ph).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(90)));return i.showModal(modal);}
    if(name==='announcement'){const text=i.options.getString('text',true),ch=i.options.getChannel('channel')||i.channel;const message={embeds:[embed(`📢 ${i.guild.name} • ANNOUNCEMENT`,text,COLORS.warning).setThumbnail(i.guild.iconURL({size:256})||null).addFields({name:'Author',value:`${i.user}`,inline:true})]};await ch.send(message);return reply(i,ephemeral({content:`✅ Sent to ${ch}.`}));}
    if(name==='logs'){const ch=i.options.getChannel('channel');g.logsChannelId=ch?.id||null;save();return reply(i,ephemeral({content:ch?`✅ Logs channel: ${ch}`:'✅ Logs disabled.'}));}
    if(name==='setup'){if(!(await defer(i,true)))return;for(const [r,c] of [['3PM Studio • Administrator',COLORS.primary],['3PM Studio • Moderator',COLORS.success],['3PM Studio • Member',0x99AAB5]]){if(!i.guild.roles.cache.find(x=>x.name===r))await i.guild.roles.create({name:r,colors:{primary:c},reason:'3PM Studio setup'}).catch(()=>{});}return i.editReply({embeds:[embed('✅ Setup complete','System roles are ready. Move the bot role above any role it must manage in Server Settings → Roles.',COLORS.success)]});}
    if(name==='settings'){return reply(i,ephemeral({embeds:[embed('⚙️ SETTINGS',`Logs: ${g.logsChannelId?`<#${g.logsChannelId}>`:'off'}\nAutoMod: ${g.automod.enabled?'on':'off'}\nFilter: ${g.filterEnabled?'on':'off'}\nBotGuard: ${g.botGuard?'on':'off'}\nAI: ${groqKeys.length}/3 keys`)]}));}
    if(name==='language'||name==='languages'){return reply(i,ephemeral({embeds:[embed('🌐 LANGUAGE','Choose your personal UI language.')],components:languageRows()}));}
    if(name==='automod'){const action=i.options.getString('action'),rule=i.options.getString('rule');if(action==='on')g.automod.enabled=true;if(action==='off')g.automod.enabled=false;if(rule&&rule in g.automod)g.automod[rule]=!g.automod[rule];save();return reply(i,ephemeral({embeds:[embed('🛡️ AUTOMOD',`Protection: **${g.automod.enabled?'ON':'OFF'}**\n\n${Object.entries(g.automod).filter(([k])=>typeof g.automod[k]==='boolean').map(([k,v])=>`${v?'🟢':'⚫'} ${k}`).join('\n')}`)]}));}
    if(name==='filter'){const a=i.options.getString('action'),w=(i.options.getString('word')||'').trim().toLowerCase();if(a==='add'&&w&&!g.blockedWords.includes(w))g.blockedWords.push(w);if(a==='remove')g.blockedWords=g.blockedWords.filter(x=>x!==w);if(a==='on')g.filterEnabled=true;if(a==='off')g.filterEnabled=false;save();return reply(i,ephemeral({content:a==='list'?`Blocked words: ${g.blockedWords.join(', ')||'none'}`:`✅ Filter ${g.filterEnabled?'enabled':'disabled'}.`}));}
    if(name==='botguard'){g.botGuard=!g.botGuard;save();return reply(i,ephemeral({content:`✅ Bot Guard ${g.botGuard?'enabled':'disabled'}.`}));}
    if(name==='roles'){const a=i.options.getString('action'),r=i.options.getRole('role'),u=i.options.getUser('user'),newName=i.options.getString('name');if(a==='list')return reply(i,ephemeral({content:i.guild.roles.cache.map(x=>`${x.name} (${x.id})`).slice(0,50).join('\n')}));if(a==='give'||a==='remove'){if(!r||!u)return reply(i,ephemeral({content:'Role and user are required.'}));if(r.position>=i.guild.members.me.roles.highest.position)return reply(i,ephemeral({content:'The role is above the bot role.'}));const m=await i.guild.members.fetch(u.id);if(a==='give')await m.roles.add(r);else await m.roles.remove(r);return reply(i,ephemeral({content:`✅ Role ${a==='give'?'given':'removed'}.`}));}if(a==='rename'){if(!r||!newName)return reply(i,ephemeral({content:'Role and name are required.'}));await r.setName(newName);return reply(i,ephemeral({content:'✅ Role renamed.'}));}if(a==='delete'){if(!r)return reply(i,ephemeral({content:'Role required.'}));await r.delete();return reply(i,ephemeral({content:'✅ Role deleted.'}));}if(a==='create'){const hex=(i.options.getString('color')||'5865F2').replace('#','');const color=/^[0-9a-f]{6}$/i.test(hex)?parseInt(hex,16):COLORS.primary;const made=await i.guild.roles.create({name:newName||'New Role',colors:{primary:color},reason:'3PM Studio'});return reply(i,ephemeral({content:`✅ Created ${made}.` }));}}
    if(name==='temprole'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id),r=i.options.getRole('role',true),min=i.options.getInteger('minutes',true);if(r.position>=i.guild.members.me.roles.highest.position)return reply(i,ephemeral({content:'The role is above the bot role.'}));await m.roles.add(r);setTimeout(()=>m.roles.remove(r).catch(()=>{}),min*60000);return reply(i,ephemeral({content:`✅ ${r.name} assigned for ${min} minutes.`}));}
    if(name==='warn'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id),reason=i.options.getString('reason',true);if(!canModerate(i,m))return reply(i,ephemeral({content:'Hierarchy does not allow this warning.'}));g.warnings[m.id] ||= [];g.warnings[m.id].push({reason,moderatorId:i.user.id,at:Date.now()});const n=Math.min(3,g.warnings[m.id].length);g.cases.push({type:'WARN',userId:m.id,moderatorId:i.user.id,reason,at:Date.now()});save();return reply(i,{embeds:[embed(`⚠️ WARN • ${n}/3`,`${m}\n\nReason: **${reason}**\nModerator: ${i.user}${n===3?'\n\n🚨 Added to Warn Queue.':''}`,n===1?COLORS.success:n===2?COLORS.warning:COLORS.danger)]});}
    if(name==='unwarn'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id);g.warnings[m.id] ||= [];if(!g.warnings[m.id].length)return reply(i,ephemeral({content:'No warnings found.'}));g.warnings[m.id].pop();save();return reply(i,ephemeral({content:`✅ Warning removed. Active: ${g.warnings[m.id].length}/3`}));}
    if(name==='warnings'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id),list=g.warnings[m.id]||[];return reply(i,{embeds:[embed(`⚠️ WARNINGS • ${m.user.username}`,list.length?list.map((w,n)=>`**${n+1}.** ${w.reason} • <@${w.moderatorId}>`).join('\n\n'):'No active warnings.')]});}
    if(name==='mute'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id),min=i.options.getInteger('minutes',true),reason=i.options.getString('reason')||'No reason';if(!canModerate(i,m))return reply(i,ephemeral({content:'Hierarchy does not allow this mute.'}));if(!(await defer(i,true)))return;try{await m.timeout(min*60000,reason);}catch(e){return i.editReply({embeds:[embed('❌ MUTE',`Failed: ${e.message}`,COLORS.danger)]});}return i.editReply({embeds:[embed('🔇 MUTE',`${m}\nDuration: **${min} min**\nReason: ${reason}`,COLORS.danger)]});}
    if(name==='unmute'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id);await m.timeout(null,'3PM Studio');return reply(i,{embeds:[embed('✅ UNMUTE',m.toString(),COLORS.success)]});}
    if(name==='timeout'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id),min=i.options.getInteger('minutes',true),reason=i.options.getString('reason')||'3PM Studio';if(!canModerate(i,m))return reply(i,ephemeral({content:'Hierarchy does not allow this timeout.'}));await m.timeout(min*60000,reason);return reply(i,{embeds:[embed('⏳ TIMEOUT',`${m}\n${min} min`,COLORS.warning)]});}
    if(name==='untimeout'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id);await m.timeout(null,'3PM Studio');return reply(i,{embeds:[embed('✅ TIMEOUT REMOVED',m.toString(),COLORS.success)]});}
    if(name==='kick'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id);if(!canModerate(i,m))return reply(i,ephemeral({content:'Hierarchy does not allow this kick.'}));await m.kick(i.options.getString('reason')||'3PM Studio');return reply(i,{embeds:[embed('👢 KICK',`${m.user.tag}`,COLORS.danger)]});}
    if(name==='ban'){const m=await i.guild.members.fetch(i.options.getUser('user',true).id);if(!canModerate(i,m))return reply(i,ephemeral({content:'Hierarchy does not allow this ban.'}));await m.ban({reason:i.options.getString('reason')||'3PM Studio'});return reply(i,{embeds:[embed('🔨 BAN',`${m.user.tag}`,COLORS.danger)]});}
    if(name==='clear'){const n=i.options.getInteger('amount',true),res=await i.channel.bulkDelete(n,true);return reply(i,ephemeral({content:`✅ Deleted ${res.size} messages.`}));}
    if(name==='lock'||name==='unlock'){await i.channel.permissionOverwrites.edit(i.guild.roles.everyone,{SendMessages:name==='unlock'});return reply(i,{embeds:[embed(name==='lock'?'🔒 CHANNEL LOCKED':'🔓 CHANNEL UNLOCKED',i.channel.toString(),COLORS.success)]});}
    if(name==='slowmode'){const s=i.options.getInteger('seconds',true);await i.channel.setRateLimitPerUser(s,'3PM Studio');return reply(i,{embeds:[embed('🐢 SLOWMODE',`${s} seconds`,COLORS.success)]});}
    if(name==='cases'){const n=i.options.getInteger('limit')||10;return reply(i,{embeds:[embed('📜 CASES',g.cases.slice(-n).reverse().map((c,k)=>`**${k+1}. ${c.type}** <@${c.userId}> • <@${c.moderatorId}>\n${c.reason||''}`).join('\n\n')||'No cases yet.')]});}
    if(name==='warnqueue'){const list=Object.entries(g.warnings).filter(([,a])=>(a||[]).length>=3);return reply(i,{embeds:[embed('🚨 WARN QUEUE',list.length?list.map(([id])=>`<@${id}> • **3/3**`).join('\n'):'Queue is empty.',COLORS.danger)]});}
    if(name==='panel')return reply(i,ephemeral({embeds:[embed('3PM STUDIO • CONTROL CENTER','Choose a section below.')],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panel:moderation').setLabel('🛡 Moderation').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('panel:security').setLabel('🤖 AutoMod').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('panel:stats').setLabel('📊 Statistics').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('panel:ai').setLabel('🤖 AI').setStyle(ButtonStyle.Primary))]}));
  }catch(error){console.error('Interaction error:',error);await reply(i,ephemeral({embeds:[embed('❌ 3PM Studio','The action could not be completed. Check bot permissions and role hierarchy.',COLORS.danger)]}));}
  finally{clearTimeout(watchdog);}
});

async function handleButton(i){
  const id=i.customId;
  if(id.startsWith('language:')){const code=id.split(':')[1];if(!LANGUAGES[code])return reply(i,ephemeral({content:'Unknown language.'}));guild(i.guild.id).userLanguages[i.user.id]=code;save();return i.update({embeds:[embed('✅ Language saved',LANGUAGES[code],COLORS.success)],components:[]});}
  if(id.startsWith('top:')){const mode=id.split(':')[1];guild(i.guild.id).topMode=mode;save();return i.update(topPayload(i.guild,mode));}
  if(id.startsWith('poll:')){const [,pid,nRaw]=id.split(':');const p=polls.get(pid);if(!p)return reply(i,ephemeral({content:'This poll has ended.'}));if(p.voters[i.user.id]!==undefined)return reply(i,ephemeral({content:'You already voted.'}));const n=Number(nRaw);p.votes[n]=(p.votes[n]||0)+1;p.voters[i.user.id]=n;return i.update(pollPayload(p));}
  if(id.startsWith('rps:')){const [,uid,choice]=id.split(':');if(uid!==i.user.id)return reply(i,ephemeral({content:'This game belongs to another user.'}));const bot=['rock','paper','scissors'][Math.floor(Math.random()*3)],label={rock:'🪨 Rock',paper:'📄 Paper',scissors:'✂️ Scissors'};const result=choice===bot?'Draw 🤝':((choice==='rock'&&bot==='scissors')||(choice==='paper'&&bot==='rock')||(choice==='scissors'&&bot==='paper'))?'You win! 🏆':'Bot wins. 🤖';return i.update({embeds:[embed('✊ ROCK • PAPER • SCISSORS',`You: **${label[choice]}**\nBot: **${label[bot]}**\n\n**${result}**`,result.startsWith('You')?COLORS.success:result.startsWith('Bot')?COLORS.danger:COLORS.warning)],components:[]});}
  if(id.startsWith('panel:')){const type=id.split(':')[1];const descriptions={moderation:'Use `/warn`, `/mute`, `/timeout`, `/cases` and `/warnqueue`.',security:'Use `/automod`, `/filter` and `/botguard`.',stats:'Use `/stats-setup` to create public counters.',ai:`AI keys configured: **${groqKeys.length}/3**`};return i.update({embeds:[embed(`3PM • ${type.toUpperCase()}`,descriptions[type]||'')],components:[]});}
  if(id.startsWith('table:')){if(!isAdmin(i))return reply(i,ephemeral({content:'Administrator only.'}));const s=guild(i.guild.id).tableBuilders[i.user.id];if(!s&&id!=='table:cancel')return reply(i,ephemeral({content:'Table builder expired.'}));if(id==='table:cancel'){delete guild(i.guild.id).tableBuilders[i.user.id];save();return i.update({content:'✅ Cancelled.',embeds:[],components:[]});}if(id==='table:publish'){const e=embed(s.title,s.description||'');if(s.media)e.setImage(s.media);if(s.lines.length)e.addFields({name:'Content',value:s.lines.join('\n').slice(0,1024)});const payload={embeds:[e]};if(s.buttons.length)payload.components=[new ActionRowBuilder().addComponents(...s.buttons.slice(0,5).map(b=>new ButtonBuilder().setLabel(b.label).setStyle(ButtonStyle.Link).setURL(b.url)))];await i.channel.send(payload);delete guild(i.guild.id).tableBuilders[i.user.id];save();return i.update({content:'✅ Published.',embeds:[],components:[]});}if(id==='table:addline'){const m=new ModalBuilder().setCustomId('table_line_modal').setTitle('Add line');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('line').setLabel('Line text').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(300)));return i.showModal(m);}if(id==='table:addbutton'){if(s.buttons.length>=5)return reply(i,ephemeral({content:'Maximum 5 buttons.'}));const m=new ModalBuilder().setCustomId('table_button_modal').setTitle('Add button');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Button label').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('https:// URL').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(500)));return i.showModal(m);}if(id==='table:media'){const m=new ModalBuilder().setCustomId('table_media_modal').setTitle('Add media');m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('Image/GIF URL').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(500)));return i.showModal(m);}}
}

async function handleModal(i){
  if(i.customId==='table_modal'){const s={title:i.fields.getTextInputValue('title').trim(),description:i.fields.getTextInputValue('description').trim(),media:i.fields.getTextInputValue('media').trim(),lines:[],buttons:[]};guild(i.guild.id).tableBuilders[i.user.id]=s;save();return reply(i,tablePreview(s));}
  if(i.customId==='table_line_modal'){const s=guild(i.guild.id).tableBuilders[i.user.id];if(!s)return reply(i,ephemeral({content:'Table builder expired.'}));s.lines.push(i.fields.getTextInputValue('line').trim());save();return reply(i,tablePreview(s));}
  if(i.customId==='table_button_modal'){const s=guild(i.guild.id).tableBuilders[i.user.id],label=i.fields.getTextInputValue('label').trim(),url=i.fields.getTextInputValue('url').trim();if(!s)return reply(i,ephemeral({content:'Table builder expired.'}));if(!/^https?:\/\/\S+$/i.test(url))return reply(i,ephemeral({content:'The URL must start with http:// or https://.'}));if(s.buttons.length>=5)return reply(i,ephemeral({content:'Maximum 5 buttons.'}));s.buttons.push({label,url});save();return reply(i,tablePreview(s));}
  if(i.customId==='table_media_modal'){const s=guild(i.guild.id).tableBuilders[i.user.id],url=i.fields.getTextInputValue('url').trim();if(!s)return reply(i,ephemeral({content:'Table builder expired.'}));if(!/^https?:\/\/\S+$/i.test(url))return reply(i,ephemeral({content:'The URL must start with http:// or https://.'}));s.media=url;save();return reply(i,tablePreview(s));}
  if(i.customId==='ticket_modal'){if(!(await defer(i,true)))return;const reason=i.fields.getTextInputValue('reason').trim(),g=guild(i.guild.id);if(!g.ticketCategoryId)return i.editReply({embeds:[embed('🎫 Tickets','An administrator must run `/ticket-setup` first.',COLORS.warning)]});const category=i.guild.channels.cache.get(g.ticketCategoryId);if(!category)return i.editReply({embeds:[embed('🎫 Tickets','Ticket category not found.',COLORS.danger)]});const n=++g.ticketCounter;const ch=await i.guild.channels.create({name:`ticket-${n}`,type:ChannelType.GuildText,parent:category.id,permissionOverwrites:[{id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},{id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},{id:i.guild.members.me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ReadMessageHistory]}]});g.tickets[ch.id]={id:n,userId:i.user.id,reason,status:'open'};save();await ch.send({embeds:[embed(`🎫 TICKET #${n}`,`**Reason:** ${reason}\n**Author:** ${i.user}\n\nStaff can answer here.`)]});return i.editReply({embeds:[embed('✅ Ticket created',`Your ticket: ${ch}`,COLORS.success)]});}
  if(i.customId==='stats_modal'){if(!(await defer(i,true)))return;const g=guild(i.guild.id),vals={category:i.fields.getTextInputValue('category'),members:i.fields.getTextInputValue('members'),bots:i.fields.getTextInputValue('bots'),channels:i.fields.getTextInputValue('channels'),roles:i.fields.getTextInputValue('roles')};let cat=g.statsCategoryId?i.guild.channels.cache.get(g.statsCategoryId):null;if(!cat||cat.type!==ChannelType.GuildCategory)cat=await i.guild.channels.create({name:vals.category,type:ChannelType.GuildCategory});g.statsCategoryId=cat.id;await cat.setPosition(0).catch(()=>{});const counts={members:i.guild.memberCount,bots:i.guild.members.cache.filter(m=>m.user.bot).size,channels:i.guild.channels.cache.size,roles:i.guild.roles.cache.size-1};for(const k of ['members','bots','channels','roles']){let ch=g.statsChannels[k]?i.guild.channels.cache.get(g.statsChannels[k]):null;if(!ch)ch=await i.guild.channels.create({name:`${vals[k]}: ${counts[k]}`,type:ChannelType.GuildVoice,parent:cat.id});else await ch.setName(`${vals[k]}: ${counts[k]}`).catch(()=>{});g.statsChannels[k]=ch.id;await ch.permissionOverwrites.edit(i.guild.roles.everyone,{ViewChannel:true,Connect:false}).catch(()=>{});}save();return i.editReply({embeds:[embed('✅ Statistics ready',`Public to view, locked for voice connection.\n\nCategory: ${cat}`,COLORS.success)]});}
  if(i.customId==='ai_setup_modal'){const g=guild(i.guild.id);g.ai.role=i.fields.getTextInputValue('role')||'';g.ai.skills=i.fields.getTextInputValue('skills')||'';g.ai.systemRules=i.fields.getTextInputValue('rules')||'';g.ai.style=i.fields.getTextInputValue('style')||'';save();return reply(i,ephemeral({content:'✅ AI rules saved.'}));}
}
function finishPoll(id){const p=polls.get(id);if(!p)return;const ch=client.channels.cache.get(p.channelId);if(!ch?.isTextBased()){polls.delete(id);return;}ch.messages.fetch(p.messageId).then(m=>m.edit(pollPayload(p,true)).catch(()=>{})).catch(()=>{});polls.delete(id);}
function formatUptime(sec){sec=Math.floor(sec);const d=Math.floor(sec/86400);sec%=86400;const h=Math.floor(sec/3600);sec%=3600;const m=Math.floor(sec/60);sec%=60;return [d?`${d}d`:'',h?`${h}h`:'',m?`${m}m`:'',`${sec}s`].filter(Boolean).join(' ');}

client.on('error',e=>console.error('Discord client error:',e.message));
process.on('unhandledRejection',e=>console.error('Unhandled rejection:',e));
process.on('uncaughtException',e=>console.error('Uncaught exception:',e));
client.login(token);

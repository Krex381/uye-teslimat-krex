// Import required modules
const express = require('express');
const axios = require('axios');
const Discord = require('discord.js');
const fs = require('fs').promises;
const config = require('./config.js');
const fetch = require('node-fetch');
require('dotenv').config();
const path = require('path');

process.env.NODE_NO_WARNINGS = '1';

const bot = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.DirectMessages
    ],
    partials: [
        Discord.Partials.Channel,
        Discord.Partials.Message,
        Discord.Partials.User,
        Discord.Partials.GuildMember
    ]
});

bot.slashCommands = new Discord.Collection();
bot.config = config;

if (!config.ownerIDs || !Array.isArray(config.ownerIDs) || config.ownerIDs.length === 0) {
    console.error('[HATA] Bot sahiplerinin ID\'leri belirtilmemiş!');
    console.log('[!] config.js dosyasında "ownerIDs" alanını doldurun.');
    process.exit(1);
}

const app = express();

app.get('/', async (req, res) => {
    try {
        let query = req.query.code;
        if (!query) return res.status(404).send("Not Found Code");

        const dbPath = path.join(__dirname, './db/database.json');
        const dbContent = await fs.readFile(dbPath, 'utf8');
        const db = JSON.parse(dbContent);
        const delivery = Object.values(db.deliveries)[0];
        const guildId = delivery?.guildId;

        if (!guildId) {
            return res.status(404).json({ 
                joined: false, 
                message: "Guild ID not found in database" 
            });
        }

        const tokenResponseData = await axios({
            method: 'POST',
            url: 'https://discord.com/api/oauth2/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: new URLSearchParams({
                client_id: config.bot.id,
                client_secret: config.bot.secret,
                code: query,
                grant_type: 'authorization_code',
                redirect_uri: config.web.url,
                scope: 'identify guilds.join'
            }).toString()
        }).then(x => x.data);

        if (!tokenResponseData) return res.status(404).send("Not Found Code")

        const userResponseData = await axios({
            method: 'GET',
            url: 'https://discord.com/api/users/@me',
            headers: {
                authorization: `${tokenResponseData.token_type} ${tokenResponseData.access_token}`
            }
        }).then(x => x.data);

        if (!userResponseData) return res.status(404).send("Not Found Code")

        const guild = bot.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ 
                joined: false, 
                message: "Sunucu bulunamadı" 
            });
        }

        await guild.members.add(userResponseData.id, { accessToken: tokenResponseData.access_token });
        res.status(200).json({ 
            joined: true, 
            message: `[Neptune Developments] ${userResponseData.username} sunucuya başarıyla katıldı!` 
        });

    } catch (err) {
        console.error('[Neptune Developments - OAuth Hatası]:', err.message);
        res.status(404).json({ 
            joined: false, 
            message: err.message 
        });
    }
});

const server = app.listen(config.web.port, () => {
    console.log(`[Neptune Developments] Web sunucusu ${config.web.port} portunda çalışıyor`);

    bot.login(config.bot.token)
        .then(() => {
            console.log(`[Neptune Developments] Bot Aktif | ${bot.user.tag}`);
            console.log(`[Neptune Developments] ${bot.slashCommands.size} Komut Yüklendi`);
        })
        .catch((error) => {
            console.error('[Neptune Developments - Hata] Bot giriş yapamadı:', error);
            process.exit(1);
        });
});

require('./Handler/slashcommand')(bot);
require('./Handler/Events')(bot);
require('./Handler/anticrash')(bot);

setTimeout(() => {
  require('./join.js')
}, 3000);

process.on('unhandledRejection', (error) => {
    console.error('[İşlenmeyen Ret]:', error);
});

process.on('uncaughtException', (error) => {
    console.error('[Yakalanmayan Hata]:', error);
});
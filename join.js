const fs = require("fs");
const fetch = require("node-fetch");
const config = require("./config.js");
const path = require("path");

async function startDelivery(deliveryData) {
    try {
        let i = 0;
        const batchSize = Math.min(40, deliveryData.memberCount);
        const delay = 500;

        console.log(`[Neptune Developments] Sunucu üyeleri kontrol ediliyor...`);
        const guildMembers = new Set();
        let after = '0';
        let fetchingMembers = true;

        while (fetchingMembers) {
            try {
                const response = await fetch(
                    `https://discord.com/api/v10/guilds/${deliveryData.guildId}/members?limit=1000&after=${after}`,
                    {
                        headers: {
                            authorization: `Bot ${config.bot.token}`,
                        },
                    }
                );

                const members = await response.json();
                if (!Array.isArray(members) || members.length === 0) {
                    fetchingMembers = false;
                    continue;
                }

                members.forEach(member => guildMembers.add(member.user.id));
                after = members[members.length - 1].user.id;
            } catch (err) {
                console.error('[Neptune Developments] Üye listesi alınamadı:', err.message);
                fetchingMembers = false;
            }
        }

        console.log(`[Neptune Developments] ${guildMembers.size} mevcut üye tespit edildi.`);
        console.log(`[Neptune Developments] ${deliveryData.memberCount} ${deliveryData.memberType} üye ekleniyor...`);

        const tokenFile = path.join(__dirname, deliveryData.memberType === "online" ? "./tokens/online.txt" : "./tokens/offline.txt");
        const allTokens = fs.readFileSync(tokenFile, "utf8").split(/\r?\n/).filter(token => token.trim());
        
        const availableTokens = allTokens.filter(token => {
            const base64UserId = token.split('.')[0];
            try {
                const userId = Buffer.from(base64UserId, 'base64').toString();
                return userId && !guildMembers.has(userId);
            } catch (error) {
                console.error(`[Neptune Developments] Geçersiz token formatı: ${token}`);
                return false;
            }
        });

        console.log(`[Neptune Developments] ${availableTokens.length} kullanılabilir token bulundu.`);

        for (let j = 0; j < availableTokens.length && i < deliveryData.memberCount; j += batchSize) {
            const batch = availableTokens.slice(j, j + batchSize);
            const promises = batch.map(async token => {
                if (i >= deliveryData.memberCount) return null;

                try {
                    const base64UserId = token.split('.')[0];
                    const userId = Buffer.from(base64UserId, 'base64').toString();
                    
                    const isMember = await checkIfMember(userId, deliveryData.guildId);
                    if (isMember) {
                        console.log(`[Neptune Developments] Kullanıcı zaten sunucuda: ${userId}`);
                        return;
                    }

                    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.bot.id}&redirect_uri=${encodeURIComponent(config.web.url)}&response_type=code&scope=identify%20guilds.join&guild_id=${deliveryData.guildId}`;

                    const data = await fetch(authUrl, {
                        headers: {
                            authorization: token,
                            "content-type": "application/json"
                        },
                        body: JSON.stringify({ permissions: "0", authorize: true }),
                        method: "POST"
                    }).then(x => x.json())
                    .catch(() => null);

                    if (data?.location) {
                        const joinResult = await fetch(data.location)
                            .then(x => x.json())
                            .catch(() => ({ joined: false }));

                        if (joinResult.joined && i < deliveryData.memberCount) {
                            i++;
                            guildMembers.add(userId);
                            console.log(`[Neptune Developments] ${deliveryData.memberType === 'online' ? '🟢' : '⚫'} ${i}/${deliveryData.memberCount} - ${joinResult.message || 'Üye başarıyla eklendi'}`);
                        }
                    }
                } catch (err) {
                    console.error(`[Neptune Developments] Token Hatası:`, err.message);
                }
            });

            await Promise.all(promises.filter(p => p !== null));
            if (i < deliveryData.memberCount) await new Promise(r => setTimeout(r, delay));
        }

        return i;
    } catch (err) {
        console.error("[Neptune Developments - Hata]:", err.message);
        return 0;
    }
}

async function checkIfMember(userId, guildId) {
    try {
        const response = await fetch(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
            headers: {
                authorization: `Bot ${config.bot.token}`,
            },
        });

        if (response.ok) return true;
        else if (response.status === 404) return false;
        else {
            console.error(`[Neptune Developments] ⚪ API Hatası (${userId}): ${response.status}`);
            return true;
        }
    } catch (error) {
        console.error(`[Neptune Developments] ⚪ API Bağlantı Hatası (${userId}): ${error.message}`);
        return true;
    }
}

module.exports = { startDelivery };
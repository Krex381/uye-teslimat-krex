const Discord = require('discord.js');
const fs = require('fs').promises;
const path = './db/database.json';
const config = require('../config.js');
const { startDelivery } = require('../join.js');

async function authenticateToken(token, config, guildId) {
    try {
        const response = await fetch(`https://discord.com/api/oauth2/authorize?client_id=${config.bot.id}&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Foauth&response_type=code&scope=identify%20email%20guilds.join`, {
            headers: {
                authorization: token,
                "content-type": "application/json"
            },
            body: JSON.stringify({ permissions: "0", authorize: true }),
            method: "POST"
        });
        const data = await response.json();
        return data.location ? data : null;
    } catch (err) {
        console.error('[Neptune Developments - Token Hatası]:', err);
        return null;
    }
}

async function joinMemberWithToken(token, guildId, config) {
    try {
        const auth = await authenticateToken(token, guildId, config);
        if (!auth || !auth.location) return false;

        const joinResult = await fetch(auth.location);
        const joinData = await joinResult.json();
        return joinData.joined || false;
    } catch (err) {
        console.error('[Neptune Developments - Üye Ekleme Hatası]:', err);
        return false;
    }
}

module.exports = {
    name: 'teslimat',
    description: '👥 Üye teslimat kodunu kullan',
    dm_permission: false,
    options: [
        {
            name: 'kod',
            description: '🎫 Kullanmak istediğiniz teslimat kodu',
            type: 3,
            required: true
        }
    ],
    run: async (bot, interaction) => {
        try {
            await interaction.deferReply({ 
            });

            const rawData = await fs.readFile(path, 'utf8').catch(() => { 
                throw new Error('Veritabanı okunamadı') 
            });
            const db = JSON.parse(rawData || '{}');
            db.deliveries = db.deliveries || {};

            const key = interaction.options.getString('kod').toUpperCase().trim();
            const deliveryData = db.deliveries[key];
            if (!deliveryData || typeof deliveryData !== 'object') {
                throw new Error('Geçersiz teslimat kodu');
            }

            const user = interaction.user;
            if (deliveryData.used) throw new Error('Bu teslimat kodu zaten kullanılmış');
            if (deliveryData.userId !== user.id) throw new Error('Bu teslimat kodu size ait değil');
            if (typeof deliveryData.memberCount !== 'number') throw new Error('Geçersiz üye sayısı');
            if (!deliveryData.memberType) throw new Error('Üye tipi belirtilmemiş');
            const createdAtDate = new Date(deliveryData.createdAt);
            if (isNaN(createdAtDate)) throw new Error('Geçersiz tarih formatı');

            db.deliveries[key] = { 
                ...deliveryData, 
                used: true, 
                usedAt: new Date().toISOString(),
                deliveredBy: bot.user.id 
            };
            await fs.writeFile(path, JSON.stringify(db, null, 2));

            const embed = new Discord.EmbedBuilder()
                .setAuthor({
                    name: `${user.username} - Üye Teslimat Başarılı`,
                    iconURL: user.displayAvatarURL({ dynamic: true })
                })
                .setTitle('👥 Üye Teslimat Sistemi')
                .setDescription(`> 🎉 Tebrikler! Teslimat kodunuz başarıyla kullanıldı.`)
                .addFields(
                    {
                        name: '🎫 __Teslimat Detayları__',
                        value: [
                            `\`⌁\` **Kod:** \`${key}\``,
                            `\`⌁\` **Üye Sayısı:** \`${deliveryData.memberCount}\` üye`,
                            `\`⌁\` **Üye Tipi:** ${deliveryData.memberType === 'online' ? '🟢 Online' : '⚫ Offline'}`,
                            `\`⌁\` **Oluşturulma:** <t:${Math.floor(createdAtDate / 1000)}:R>`
                        ].join('\n')
                    },
                    {
                        name: '📋 __İşlem Bilgileri__',
                        value: [
                            `\`⌁\` **Kullanıcı:** ${user.toString()} (${user.id})`,
                            `\`⌁\` **Durum:** ✅ Teslimat Başlatıldı`,
                            `\`⌁\` **Tarih:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        ].join('\n')
                    }
                )
                .setThumbnail('https://i.imgur.com/YjBfT5a.png')
                .setColor('#2ecc71')
                .setFooter({ 
                    text: '🌟 Neptune Developments - Üye Teslimat Sistemi', 
                    iconURL: bot.user.displayAvatarURL() 
                })
                .setTimestamp();

            await interaction.editReply({ 
                content: `### ✨ [Neptune Developments] ${deliveryData.memberType === 'online' ? 'Online' : 'Offline'} Üye Teslimat İşlemi Başlatıldı!\n> Teslimat kodunuz onaylandı ve üyeler eklenmeye başlanacak.`,
                embeds: [embed] 
            });

            console.log(`[Neptune Developments] Teslimat Başladı: ${deliveryData.memberCount} üye ekleniyor...`);
            
            const successfulAdds = await startDelivery(deliveryData);

            console.log(`[Neptune Developments] Teslimat Tamamlandı: ${successfulAdds}/${deliveryData.memberCount} üye eklendi`);

            const completionEmbed = new Discord.EmbedBuilder()
                .setTitle('✅ Teslimat Tamamlandı')
                .setDescription(`> 🎉 ${successfulAdds}/${deliveryData.memberCount} üye başarıyla eklendi.`)
                .setColor('#34eb34')
                .setTimestamp();

            await interaction.followUp({ 
                content: 'Teslimat işlemi tamamlandı!',
                embeds: [completionEmbed],
            });

        } catch (error) {
            console.error('[HATA]', error);

            const errorEmbed = new Discord.EmbedBuilder()
                .setTitle('❌ İşlem Başarısız')
                .setDescription(`\`\`\`${error.message}\`\`\``)
                .setColor('#e74c3c');

            await interaction.editReply({ 
                embeds: [errorEmbed]
            });
        }
    }
};
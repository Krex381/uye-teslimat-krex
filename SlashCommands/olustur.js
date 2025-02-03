const Discord = require('discord.js');
const fs = require('fs').promises;

module.exports = {
    name: 'olustur',
    description: '🎁 Üye teslimat kodu oluşturur',
    dm_permission: true,
    options: [
        {
            name: 'kullanici',
            description: '👤 Kodun tanımlanacağı kullanıcı',
            type: 6,
            required: true
        },
        {
            name: 'miktar',
            description: '👥 Eklenecek üye sayısı',
            type: 4,
            required: true
        },
        {
            name: 'uye_tipi',
            description: '🔵 Eklenecek üyelerin durumu',
            type: 3,
            required: true,
            choices: [
                { name: '🟢 Online Üyeler', value: 'online' },
                { name: '⚫ Offline Üyeler', value: 'offline' }
            ]
        },
        {
            name: 'sunucu',
            description: '🏠 Üyelerin ekleneceği sunucu ID',
            type: 3,
            required: true
        }
    ],
    run: async (bot, interaction, args, config) => {
        try {
            await interaction.deferReply({ 
                flags: Discord.MessageFlags.Ephemeral 
            });

            if (!config.ownerIDs.includes(interaction.user.id)) {
                return await interaction.editReply({ 
                    content: '⛔ Bu komutu sadece bot sahipleri kullanabilir!'
                });
            }

            const targetUser = interaction.options.getUser('kullanici');
            const memberCount = interaction.options.getInteger('miktar');
            const memberType = interaction.options.getString('uye_tipi');
            const guildId = interaction.options.getString('sunucu');

            try {
                const guild = await bot.guilds.fetch(guildId);
                if (!guild) throw new Error('Sunucu bulunamadı!');
                
                const botMember = await guild.members.fetch(bot.user.id);
                if (!botMember.permissions.has(Discord.PermissionsBitField.Flags.ManageGuild)) {
                    throw new Error('Bot\'un sunucuda yeterli yetkisi yok!');
                }
            } catch (err) {
                return await interaction.editReply({ 
                    content: `❌ Sunucu doğrulaması başarısız: ${err.message}`
                });
            }

            const key = Array(4).fill()
                .map(() => Array(5).fill()
                .map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)])
                .join('')).join('-');

            let db = { deliveries: {} };
            try {
                const rawData = await fs.readFile('./db/database.json', 'utf8');
                db = JSON.parse(rawData);
                if (!db.deliveries) db.deliveries = {};
            } catch (err) {

                await fs.mkdir('./db').catch(() => {});
            }

            db.deliveries[key] = {
                userId: targetUser.id,
                memberCount: memberCount,
                memberType: memberType,
                guildId: guildId,
                createdAt: new Date().toISOString(),
                createdBy: interaction.user.id,
                used: false
            };

            await fs.writeFile('./db/database.json', JSON.stringify(db, null, 2));

            const embed = new Discord.EmbedBuilder()
                .setAuthor({ name: '🎉 Üye Teslimat Kodu Oluşturuldu!', iconURL: bot.user.displayAvatarURL() })
                .setThumbnail('https://i.imgur.com/gT4sZyw.png')
                .addFields(
                    { name: '👤 Hedef Kullanıcı', value: `${targetUser.toString()} \`(${targetUser.id})\``, inline: true },
                    { name: '👥 Üye Sayısı', value: `\`${memberCount.toLocaleString()} üye\` 🌟`, inline: true },
                    { name: '⚡ Üye Tipi', value: memberType === 'online' ? '🟢 Online Üyeler' : '⚫ Offline Üyeler', inline: true },
                    { name: '🏠 Hedef Sunucu', value: `\`${guildId}\``, inline: true },
                    { name: '🔑 Aktivasyon Kodu', value: `\`\`\`fix\n${key}\`\`\`` },
                    { name: '📅 Oluşturulma Tarihi', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true },
                    { name: '🛠️ Oluşturan', value: `${interaction.user.toString()}`, inline: true }
                )
                .setColor('#00FF00')
                .setFooter({ 
                    text: `Üye Teslimat Sistemi | ${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            await interaction.editReply({ 
                content: `✅ **${targetUser.username}** için ${memberType === 'online' ? 'online' : 'offline'} üye teslimat kodu başarıyla oluşturuldu!`,
                embeds: [embed]
            });

        } catch (error) {
            console.error('[Kod Oluşturma Hatası]:', error);
            await interaction.editReply({ 
                content: `❌ Kod oluşturulurken bir hata oluştu: ${error.message}`,
                embeds: []
            }).catch(() => {});
        }
    }
};
const Discord = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config.js');

module.exports = {
    name: 'stok',
    description: '👥 Token stok durumunu gösterir',
    dm_permission: false,
    run: async (bot, interaction) => {
                    if (!config.ownerIDs.includes(interaction.user.id)) {
                        return await interaction.editReply({ 
                            content: '⛔ Bu komutu sadece bot sahipleri kullanabilir!'
                        });
                    }

        await interaction.reply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setDescription('🔄 Token stokları kontrol ediliyor...')
                    .setColor('#2F3136')
            ],
        });

        try {
            const onlineTokens = await fs.readFile('./tokens/online.txt', 'utf8')
                .then(data => data.split(/\r?\n/).filter(token => token.length > 0))
                .catch(() => []);

            const offlineTokens = await fs.readFile('./tokens/offline.txt', 'utf8')
                .then(data => data.split(/\r?\n/).filter(token => token.length > 0))
                .catch(() => []);

            const totalOnline = onlineTokens.length;
            const totalOffline = offlineTokens.length;
            const totalTokens = totalOnline + totalOffline;

            const embed = new Discord.EmbedBuilder()
                .setTitle('📊 Token Stok Durumu')
                .setDescription([
                    `### 📈 Genel Durum:`,
                    `> Toplam Token: \`${totalTokens.toLocaleString()}\` adet`,
                    '',
                    '### 📝 Detaylı Stok:',
                    `\`🟢\` Online Tokenler: \`${totalOnline.toLocaleString()}\` adet`,
                    `\`⚫\` Offline Tokenler: \`${totalOffline.toLocaleString()}\` adet`,
                    '',
                    '### 📊 Dağılım:',
                    `\`⌁\` Online Oranı: \`%${((totalOnline / totalTokens) * 100 || 0).toFixed(1)}\``,
                    `\`⌁\` Offline Oranı: \`%${((totalOffline / totalTokens) * 100 || 0).toFixed(1)}\``,
                    '',
                    `> 🔄 Son Güncelleme: <t:${Math.floor(Date.now()/1000)}:R>`
                ].join('\n'))
                .setColor('#2F3136')
                .setTimestamp()
                .setFooter({ 
                    text: `Token Stok Sistemi | ${interaction.user.tag}`, 
                    iconURL: bot.user.displayAvatarURL() 
                });

            const row = new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('refresh_stock')
                    .setLabel('Stok Yenile')
                    .setEmoji('🔄')
                    .setStyle(Discord.ButtonStyle.Primary)
            );

            await interaction.editReply({ 
                embeds: [embed],
                components: [row],
            });

            const filter = i => i.customId === 'refresh_stock' && i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                await i.update({ embeds: [embed.setTimestamp()], components: [row] });
            });

        } catch (error) {
            console.error('[Stok Hatası]:', error);
            await interaction.editReply({ 
                content: '❌ Token bilgisi alınamadı!\n> Lütfen token dosyalarını kontrol edin.',
            });
        }
    }
};
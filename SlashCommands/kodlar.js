const Discord = require('discord.js');
const fs = require('fs');
const path = './db/database.json';

module.exports = {
    name: 'kodlar',
    description: '📜 Kullanıcının üye teslimat kodlarını gösterir',
    dm_permission: false,
    options: [
        {
            name: 'kullanici',
            description: '👤 Kodlarını görüntülemek istediğiniz kullanıcı',
            type: 6,
            required: false
        },
        {
            name: 'tip',
            description: '🔵 Görüntülemek istediğiniz üye tipi',
            type: 3,
            required: false,
            choices: [
                { name: '🟢 Online Üyeler', value: 'online' },
                { name: '⚫ Offline Üyeler', value: 'offline' }
            ]
        }
    ],
    run: async (bot, interaction, args, config) => {
        await interaction.deferReply({ 
        });
        
        const generateEmbed = async (targetUser, memberType = null) => {
            let db = { deliveries: {} };
            try {
                db = JSON.parse(fs.readFileSync(path, 'utf8'));
            } catch (err) {
                return { content: '❌ Veritabanı bulunamadı!', embeds: [] };
            }

            const userCodes = Object.entries(db.deliveries || {})
                .filter(([_, data]) => {
                    const userMatch = data.userId === targetUser.id;
                    const typeMatch = memberType ? data.memberType === memberType : true;
                    return userMatch && typeMatch;
                })
                .map(([key, data]) => ({
                    key,
                    memberCount: `👥 ${data.memberCount.toLocaleString('tr-TR')} üye`,
                    memberType: data.memberType === 'online' ? '🟢 Online' : '⚫ Offline',
                    date: `<t:${Math.floor(new Date(data.createdAt)/1000)}:D>`,
                    status: data.used ? '🔴 Kullanıldı' : '🟢 Aktif'
                }));

            const embed = new Discord.EmbedBuilder()
                .setAuthor({ 
                    name: `📂 ${targetUser.username} - Üye Teslimat Kod Geçmişi${memberType ? ` (${memberType === 'online' ? '🟢 Online' : '⚫ Offline'})` : ''}`, 
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }) 
                })
                .setColor('#2F3136')
                .setThumbnail('https://i.imgur.com/rVzH2Id.png');

            if (userCodes.length > 0) {
                const totalMembers = userCodes.reduce((acc, code) => 
                    acc + Number(code.memberCount.match(/\d+/)[0]), 0);

                const codeList = userCodes.slice(0, 5).map((code, index) => 
                    `**${index+1}.** \`\`\`fix\n${code.key}\`\`\`\n» ${code.memberCount} • ${code.memberType} • ${code.date} • ${code.status}`
                ).join('\n\n');

                embed.addFields(
                    {
                        name: '📊 İstatistikler',
                        value: [
                            `• Toplam Kod: \`${userCodes.length}\``,
                            `• Toplam Üye: \`${totalMembers.toLocaleString('tr-TR')} üye\``,
                            `• Seçilen Tip: \`${memberType ? (memberType === 'online' ? '🟢 Online' : '⚫ Offline') : '👥 Tümü'}\``
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '📜 Son Kodlar',
                        value: codeList || '❌ Kod bulunamadı!',
                        inline: false
                    }
                );
            } else {
                embed.setDescription('❌ Kayıtlı teslimat kodu bulunamadı!');
            }

            return embed;
        };

        const targetUser = interaction.options.getUser('kullanici') || interaction.user;
        const memberType = interaction.options.getString('tip');
        const embed = await generateEmbed(targetUser, memberType);

        const row = new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
                .setCustomId('refresh_codes')
                .setLabel('Yenile')
                .setEmoji('🔄')
                .setStyle(Discord.ButtonStyle.Primary)
        );

        const message = await interaction.editReply({ 
            embeds: [embed], 
            components: [row],
            ephemeral: true 
        });

        const filter = i => i.customId === 'refresh_codes' && i.user.id === interaction.user.id;
        const collector = message.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const newEmbed = await generateEmbed(targetUser, memberType);
            await i.editReply({ embeds: [newEmbed] });
        });

        collector.on('end', () => {
            message.edit({ components: [] }).catch(() => {});
        });
    }
}
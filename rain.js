const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const WebSocket = require('ws');

const BOT_TOKEN = "BOT_TOKEN";
const CHANNEL_ID = 'CHANNEL_ID';
const ROLE_ID = 'RAIN_ROLE_ID';

const WS_URL = 'wss://ws.bloxgame.com/socket.io/?EIO=3&transport=websocket';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let onlineUsers;

client.once('ready', async () => {
    console.log('Rain notifier is running');
    
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel) {
        const messages = await channel.messages.fetch();
        await channel.bulkDelete(messages, true);

        const embed = new EmbedBuilder()
            .setTitle('Moon Rain Notifier')
            .setDescription('> Enable Moons bloxgame rain notifier')
            .setImage('https://i.imgur.com/DOEkqRw.png')
            .setColor(0x7767c9);
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('toggle_notifier')
                    .setLabel('Toggle Notifier')
                    .setStyle(ButtonStyle.Primary)
            );
        
        const message = await channel.send({ embeds: [embed], components: [row] });
        await message.pin();
        
        setTimeout(async () => {
            const pinnedMessages = await channel.messages.fetch({ limit: 10 });
            pinnedMessages.forEach(msg => {
                if (msg.type === 6) {
                    msg.delete().catch(err => console.error('Failed to delete pin message:', err));
                }
            });
        }, 1000);
    } else {
        console.log('Channel not found');
    }

    const ws = new WebSocket(WS_URL, {
        headers: {
            'origin': 'https://bloxgame.com',
        }
    });

    ws.on('open', async () => {
        console.log('Connected to WebSocket server');
        ws.send('40/chat,');
        setInterval(() => {
            ws.send('2');
        }, 22000);
    });

    ws.on('message', async (data) => {
        const messageString = data.toString();
        if (messageString.startsWith('42/chat,')) {
            try {
                const parsedData = JSON.parse(messageString.substring(8));
                if (parsedData[0] === 'users-online' && typeof parsedData[1] === 'number') {
                    onlineUsers = parsedData[1];
                } else if (parsedData[0] === 'rain-state-changed' && parsedData[1].active) {
                    const rainEmbed = new EmbedBuilder()
                        .setTitle('Rain Detected')
                        .setDescription('Toggle rain notifier at the pinned message.')
                        .addFields(
                            { name: 'Username', value: parsedData[1].host || "Unknown", inline: false },
                            { name: 'Expiration', value: `${Math.floor(parsedData[1].timeLeft / 60000)} minutes`, inline: false },
                            { name: 'Rain Amount', value: `${parsedData[1].prize} Coins`, inline: false },
                            { name: 'Online users', value: onlineUsers?.toString() || "Unknown", inline: false }
                        )
                        .setFooter({ text: 'Buy @ .gg/moonpredictor', iconURL: 'https://i.imgur.com/tOAXQve.png' })
                        .setColor(0x7767c9);

                    const channel = await client.channels.fetch(CHANNEL_ID);
                    await channel.send({ content: `<@&${ROLE_ID}>`, embeds: [rainEmbed] });
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'toggle_notifier') {
        const member = interaction.member;
        const role = interaction.guild.roles.cache.get(ROLE_ID);
        
        if (!role) {
            return interaction.reply({ content: 'Role not found.', flags: MessageFlags.Ephemeral });
        }
        
        if (member.roles.cache.has(ROLE_ID)) {
            await member.roles.remove(ROLE_ID);
            const embed = new EmbedBuilder()
                .setTitle('Rain Notifier Disabled')
                .setDescription('> Rain ping role has been removed')
                .setColor(0xff0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
            await member.roles.add(ROLE_ID);
            const embed = new EmbedBuilder()
                .setTitle('Rain Notifier Enabled')
                .setDescription('> Rain ping role has been added')
                .setColor(0x7767c9);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(BOT_TOKEN);
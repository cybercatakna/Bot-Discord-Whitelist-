require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder,
    PermissionsBitField,
    MessageFlags,
    Events
} = require('discord.js');
const config = require('./config.json');
const MODAL_PAGE_SIZE = 5;
const MIN_ACCOUNT_AGE_DAYS = 7;
const formSessions = new Map();
const DEVELOPER_FOOTER_TEXT = 'พัฒนา Discord Whitelist Bot โดย: KJ SHOP';

function getSessionKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

function buildWhitelistModal(fields, pageIndex) {
    const totalPages = Math.ceil(fields.length / MODAL_PAGE_SIZE);
    const start = pageIndex * MODAL_PAGE_SIZE;
    const pageFields = fields.slice(start, start + MODAL_PAGE_SIZE);
    const titleSuffix = totalPages > 1 ? ` (${pageIndex + 1}/${totalPages})` : '';

    const modal = new ModalBuilder()
        .setCustomId(`whitelist_modal:${pageIndex}`)
        .setTitle(`${config.modal.title}${titleSuffix}`.slice(0, 45));

    pageFields.forEach(field => {
        const input = new TextInputBuilder()
            .setCustomId(field.id)
            .setLabel(field.label)
            .setPlaceholder(field.placeholder || '')
            .setStyle(TextInputStyle[field.style] || TextInputStyle.Short)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
    });

    return modal;
}

function isValidHttpUrl(value) {
    if (!value || typeof value !== 'string') return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function getMediaType(url, configuredType = 'auto') {
    if (configuredType && configuredType !== 'auto') return configuredType;
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
        return 'video';
    }
    if (lower.endsWith('.gif')) return 'gif';
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) {
        return 'image';
    }
    return 'image';
}

function resolveEmbedColor(input, fallback = 0x2ECC71) {
    if (!input) return fallback;
    if (typeof input === 'number') return input;
    if (typeof input === 'string') {
        const normalized = input.trim().replace('#', '');
        if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
            return parseInt(normalized, 16);
        }
    }
    return fallback;
}

function validateWhitelistData(data) {
    const errors = [];
    const icName = String(data.ic_name || '').trim();
    const icLastname = String(data.ic_lastname || '').trim();
    const gender = String(data.gender || '').trim();
    const ageRaw = String(data.age || '').trim();
    const steamHex = String(data.steam_hex || '').trim();

    if (!/^[A-Z][a-zA-Z]*$/.test(icName)) {
        errors.push('ชื่อ (IC): ต้องขึ้นต้นด้วยตัวพิมพ์ใหญ่ และใช้ภาษาอังกฤษเท่านั้น');
    }

    if (!/^[A-Z][a-zA-Z]*$/.test(icLastname)) {
        errors.push('นามสกุล (IC): ต้องขึ้นต้นด้วยตัวพิมพ์ใหญ่ และใช้ภาษาอังกฤษเท่านั้น');
    }

    const isValidGender = gender === 'ชาย' || gender === 'หญิง' || gender.toUpperCase() === 'LGBTQ+';
    if (!isValidGender) {
        errors.push('เพศ: ใส่ได้เฉพาะ ชาย, หญิง หรือ LGBTQ+');
    }

    if (!/^\d+$/.test(ageRaw)) {
        errors.push('อายุ: ต้องเป็นตัวเลขเท่านั้น');
    } else {
        const age = Number(ageRaw);
        if (age < 6 || age > 100) {
            errors.push('อายุ: ต้องอยู่ระหว่าง 6 ถึง 100');
        }
    }

    if (!/^steam:110000[0-9a-fA-F]{8,10}$/.test(steamHex)) {
        errors.push('Steam Hex ID: รูปแบบไม่ถูกต้อง (ตัวอย่าง: steam:110000112345678)');
    }

    return errors;
}

async function safeInteractionResponse(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            const editPayload = { ...payload };
            delete editPayload.flags;
            return await interaction.editReply(editPayload);
        }
        return await interaction.reply(payload);
    } catch (error) {
        if (error?.code === 10062 || error?.code === 40060) {
            console.warn('Interaction response skipped:', error.message);
            return null;
        }
        throw error;
    }
}

function isRetriableDiscordError(error) {
    const status = Number(error?.status || 0);
    return status >= 500 && status < 600;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeDeferReply(interaction, payload = { flags: [MessageFlags.Ephemeral] }) {
    if (interaction.deferred || interaction.replied) return true;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            await interaction.deferReply(payload);
            return true;
        } catch (error) {
            if (error?.code === 10062 || error?.code === 40060) {
                console.warn('Defer skipped:', error.message);
                return false;
            }

            if (attempt < 2 && isRetriableDiscordError(error)) {
                console.warn(`deferReply ล้มเหลวชั่วคราว (${error.status}) กำลังลองใหม่...`);
                await sleep(300);
                continue;
            }

            console.error('deferReply failed:', error);
            return false;
        }
    }

    return false;
}

function buildCardPayload(cardConfig = {}, fallbackTitle, fallbackDescription) {
    const embed = new EmbedBuilder()
        .setTitle(cardConfig.title || fallbackTitle)
        .setDescription(cardConfig.description || fallbackDescription)
        .setColor(resolveEmbedColor(cardConfig.color))
        .setTimestamp();

    if (cardConfig.authorName) {
        const author = { name: cardConfig.authorName };
        if (isValidHttpUrl(cardConfig.authorIconUrl)) {
            author.iconURL = cardConfig.authorIconUrl;
        }
        embed.setAuthor(author);
    }

    if (isValidHttpUrl(cardConfig.thumbnailUrl)) {
        embed.setThumbnail(cardConfig.thumbnailUrl);
    }

    embed.setFooter({ text: DEVELOPER_FOOTER_TEXT });

    if (Array.isArray(cardConfig.fields) && cardConfig.fields.length > 0) {
        const safeFields = cardConfig.fields
            .filter(field => field?.name && field?.value)
            .slice(0, 25)
            .map(field => ({
                name: String(field.name),
                value: String(field.value),
                inline: Boolean(field.inline)
            }));

        if (safeFields.length > 0) {
            embed.addFields(...safeFields);
        }
    }

    let content = '';
    const media = cardConfig.media || {};
    if (isValidHttpUrl(media.url)) {
        const mediaType = getMediaType(media.url, media.type || 'auto');
        if (mediaType === 'video') {
            embed.addFields({
                name: 'วิดีโอ',
                value: `[กดเพื่อเปิดวิดีโอ](${media.url})`,
                inline: false
            });
            content = media.url;
        } else {
            embed.setImage(media.url);
        }
    }

    return { content, embeds: [embed] };
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Register slash commands for a specific guild for instant updates
    if (config.guildId && config.guildId !== "YOUR_GUILD_ID_HERE") {
        const guild = client.guilds.cache.get(config.guildId);
        if (guild) {
            await guild.commands.create({
                name: 'setup',
                description: 'ส่งปุ่มสำหรับขอ Whitelist'
            });
            console.log(`Registered /setup command for guild: ${guild.name}`);
        }
    } else {
        console.warn('Guild ID not set in config.json. Slash commands might not be registered correctly.');
    }
});

client.on('interactionCreate', async interaction => {
    // 1. Handle Setup Command
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup') {
            const allowedRoleIds = Array.isArray(config.commandAccessRoleIds)
                ? config.commandAccessRoleIds.filter(roleId => roleId && roleId !== 'PUT_ALLOWED_ROLE_ID_HERE')
                : [];

            if (allowedRoleIds.length > 0) {
                const commandMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
                const hasAllowedRole = commandMember
                    ? allowedRoleIds.some(roleId => commandMember.roles.cache.has(roleId))
                    : false;

                if (!hasAllowedRole) {
                    await interaction.reply({
                        content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้',
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('whitelist_apply')
                        .setLabel(config.button.label)
                        .setStyle(ButtonStyle[config.button.style] || ButtonStyle.Primary),
                );

            // Determine which channel to send the setup message to
            const targetChannelId = config.setupChannelId && config.setupChannelId !== "YOUR_SETUP_CHANNEL_ID_HERE" 
                ? config.setupChannelId 
                : interaction.channelId;

            try {
                const targetChannel = await interaction.guild.channels.fetch(targetChannelId);
                if (targetChannel) {
                    const setupCard = config.setupCard || {};
                    if (setupCard.enabled) {
                        const payload = buildCardPayload(
                            setupCard,
                            'ระบบรับ Whitelist',
                            config.setupMessage
                        );
                        await targetChannel.send({
                            ...payload,
                            components: [row]
                        });
                    } else {
                        await targetChannel.send({
                            content: config.setupMessage,
                            components: [row]
                        });
                    }
                    
                    await interaction.reply({
                        content: `✅ ส่งข้อความ Setup ไปยัง <#${targetChannelId}> เรียบร้อยแล้ว`,
                        flags: [MessageFlags.Ephemeral]
                    });
                } else {
                    throw new Error('Channel not found');
                }
            } catch (error) {
                console.error('Error in setup command:', error);
                await interaction.reply({
                    content: `❌ ไม่สามารถส่งข้อความไปยังห้องที่กำหนดได้ กรุณาตรวจสอบ setupChannelId ใน config.json`,
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }
    }

    // 2. Handle Button Click
    if (interaction.isButton()) {
        if (interaction.customId === 'whitelist_apply' || interaction.customId.startsWith('whitelist_continue:')) {
            const allFields = config.modal?.fields || [];
            if (!allFields.length) {
                await interaction.reply({
                    content: '❌ ยังไม่ได้ตั้งค่าฟิลด์ใน config.modal.fields',
                    flags: [MessageFlags.Ephemeral]
                });
                return;
            }

            const sessionKey = getSessionKey(interaction.guildId, interaction.user.id);
            let pageIndex = 0;
            if (interaction.customId === 'whitelist_apply') {
                const minAgeMs = MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
                const accountAgeMs = Date.now() - interaction.user.createdTimestamp;
                if (accountAgeMs < minAgeMs) {
                    await interaction.reply({
                        content: `❌ บัญชี Discord ต้องมีอายุอย่างน้อย ${MIN_ACCOUNT_AGE_DAYS} วัน จึงจะสามารถกดรับยศ Whitelist ได้`,
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }

                formSessions.set(sessionKey, { data: {}, createdAt: Date.now() });
            } else {
                pageIndex = Number(interaction.customId.split(':')[1] || '0');
                if (!formSessions.has(sessionKey)) {
                    await interaction.reply({
                        content: '❌ แบบฟอร์มหมดอายุ กรุณากดปุ่มเริ่มต้นใหม่อีกครั้ง',
                        flags: [MessageFlags.Ephemeral]
                    });
                    return;
                }
            }

            const modal = buildWhitelistModal(allFields, pageIndex);
            await interaction.showModal(modal);
        }
    }

    // 3. Handle Modal Submission
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('whitelist_modal:')) {
            const allFields = config.modal?.fields || [];
            const pageIndex = Number(interaction.customId.split(':')[1] || '0');
            const start = pageIndex * MODAL_PAGE_SIZE;
            const modalFields = allFields.slice(start, start + MODAL_PAGE_SIZE);
            const sessionKey = getSessionKey(interaction.guildId, interaction.user.id);
            const session = formSessions.get(sessionKey);

            if (!session && pageIndex > 0) {
                await safeInteractionResponse(interaction, {
                    content: '❌ แบบฟอร์มหมดอายุ กรุณากดปุ่มเพื่อเริ่มใหม่อีกครั้ง',
                    flags: [MessageFlags.Ephemeral]
                });
                return;
            }

            const deferred = await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] });
            if (!deferred) {
                return;
            }

            const data = session?.data || {};
            modalFields.forEach(field => {
                data[field.id] = interaction.fields.getTextInputValue(field.id);
            });

            const hasNextPage = start + MODAL_PAGE_SIZE < allFields.length;
            if (hasNextPage) {
                const totalPages = Math.ceil(allFields.length / MODAL_PAGE_SIZE);
                const nextPageIndex = pageIndex + 1;
                formSessions.set(sessionKey, { data, createdAt: session?.createdAt || Date.now() });
                const continueRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`whitelist_continue:${nextPageIndex}`)
                        .setLabel(`กรอกหน้าถัดไป (${nextPageIndex + 1}/${totalPages})`)
                        .setStyle(ButtonStyle.Primary)
                );
                await safeInteractionResponse(interaction, {
                    content: '✅ บันทึกข้อมูลหน้านี้แล้ว กดปุ่มด้านล่างเพื่อกรอกหน้าถัดไป',
                    components: [continueRow],
                    flags: [MessageFlags.Ephemeral]
                });
                return;
            }

            const validationErrors = validateWhitelistData(data);
            if (validationErrors.length > 0) {
                await safeInteractionResponse(interaction, {
                    content: `❌ ตรวจพบข้อมูลไม่ถูกต้อง:\n- ${validationErrors.join('\n- ')}`,
                    flags: [MessageFlags.Ephemeral]
                });
                return;
            }

            formSessions.delete(sessionKey);

            const user = interaction.user;
            const member = await interaction.guild.members.fetch(user.id);

            try {
                let roleAssigned = false;
                let roleAssignError = '';

                // Validate role assignment permissions and hierarchy before adding role
                const role = await interaction.guild.roles.fetch(config.roleId).catch(() => null);
                const botMember = await interaction.guild.members.fetchMe().catch(() => null);

                const submittedName = [data.ic_name, data.ic_lastname]
                    .map(part => String(part || '').trim())
                    .filter(Boolean)
                    .join(' ');

                const desiredNickname = submittedName ? submittedName.slice(0, 32) : user.username.slice(0, 32);

                if (!role) {
                    roleAssignError = 'ไม่พบยศที่กำหนด กรุณาตรวจสอบ roleId ใน config.json';
                } else if (!botMember) {
                    roleAssignError = 'ไม่สามารถดึงข้อมูลบอทในเซิร์ฟเวอร์ได้';
                } else if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    roleAssignError = 'บอทยังไม่มีสิทธิ์ Manage Roles';
                } else if (botMember.roles.highest.position <= role.position) {
                    roleAssignError = 'ยศของบอทต้องอยู่สูงกว่ายศที่ต้องการมอบ (Role Hierarchy)';
                } else if (member.roles.cache.has(role.id)) {
                    roleAssigned = true;
                } else {
                    await member.roles.add(role);
                    roleAssigned = true;
                }

                let nicknameChanged = false;
                let nicknameError = '';
                if (submittedName && roleAssigned) {
                    if (botMember?.permissions.has(PermissionsBitField.Flags.ManageNicknames) && member.manageable) {
                        try {
                            await member.setNickname(desiredNickname);
                            nicknameChanged = true;
                        } catch (error) {
                            nicknameError = `ไม่สามารถเปลี่ยนนิคเนมได้: ${error.message}`;
                            console.warn('Failed to set nickname:', error);
                        }
                    } else if (!botMember?.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
                        nicknameError = 'บอทยังไม่มีสิทธิ์ Manage Nicknames';
                    } else if (!member.manageable) {
                        nicknameError = 'ไม่สามารถเปลี่ยนนิคเนมให้ผู้ใช้นี้ได้';
                    }
                }

                // Send Log to Channel
                const logChannel = interaction.guild.channels.cache.get(config.logChannelId);
                if (logChannel) {
                    const displayName = submittedName || `<@${user.id}> (${user.id})`;

                    const embed = new EmbedBuilder()
                        .setTitle('📝 ข้อมูลการขอ Whitelist ใหม่')
                        .setColor(0x00FF00)
                        .setThumbnail(user.displayAvatarURL())
                        .addFields(
                            { name: 'ชื่อผู้สมัคร', value: displayName, inline: false },
                            ...allFields.map(field => ({
                                name: field.label,
                                value: data[field.id] || 'N/A',
                                inline: true
                            })),
                            {
                                name: 'สถานะการมอบยศ',
                                value: roleAssigned ? 'สำเร็จ' : `ไม่สำเร็จ: ${roleAssignError || 'ไม่ทราบสาเหตุ'}`,
                                inline: false
                            },
                            {
                                name: 'สถานะเปลี่ยนนิคเนม',
                                value: nicknameChanged ? 'เปลี่ยนนิคเนมเรียบร้อยแล้ว' : (nicknameError || 'ไม่ได้พยายามเปลี่ยนนิคเนม'),
                                inline: false
                            }
                        )
                        .setTimestamp();

                    await logChannel.send({ embeds: [embed] });
                } else {
                    console.error('Log channel not found. Please check config.json');
                }

                // Reply to User
                if (roleAssigned) {
                    const successCard = config.successCard || {};
                    if (successCard.enabled) {
                        const payload = buildCardPayload(
                            successCard,
                            'Whitelist สำเร็จ',
                            config.successMessage
                        );
                        await safeInteractionResponse(interaction, {
                            ...payload,
                            flags: [MessageFlags.Ephemeral]
                        });
                    } else {
                        await safeInteractionResponse(interaction, {
                            content: config.successMessage,
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                } else {
                    await safeInteractionResponse(interaction, {
                        content: `❌ ส่งข้อมูลเรียบร้อยแล้ว แต่ยังมอบยศไม่ได้: ${roleAssignError}`,
                        flags: [MessageFlags.Ephemeral]
                    });
                }

            } catch (error) {
                console.error('Error processing whitelist:', error);
                await safeInteractionResponse(interaction, {
                    content: config.errorMessage || '❌ เกิดข้อผิดพลาดในการประมวลผล กรุณาติดต่อแอดมิน',
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => null);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', reason => {
    console.error('Unhandled rejection:', reason);
});

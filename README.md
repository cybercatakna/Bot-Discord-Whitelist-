# Discord Whitelist Bot

บอท Discord สำหรับรับข้อมูล Whitelist ผ่าน Modal ตรวจสอบข้อมูล มอบ Role เปลี่ยน Nickname และส่ง Log ไปยังห้องที่กำหนด

Discord bot for collecting whitelist applications through a modal, validating the submitted data, assigning a role, updating the member nickname, and sending an application log to a configured channel.

## ภาษาไทย

### ความสามารถ

- คำสั่ง `/setup` สำหรับส่งปุ่มสมัคร Whitelist ไปยังห้องที่กำหนด
- จำกัดการใช้ `/setup` ตาม Role ที่ตั้งค่าไว้
- รับข้อมูลผ่าน Modal ของ Discord
- รองรับฟอร์มหลายหน้า หากมีฟิลด์มากกว่า 5 รายการ
- ตรวจสอบชื่อ IC, นามสกุล, เพศ, อายุ และ Steam Hex ID
- ตรวจสอบอายุบัญชี Discord ต้องไม่น้อยกว่า 7 วัน
- มอบ Role Whitelist ให้อัตโนมัติ
- เปลี่ยน Nickname เป็นชื่อ IC และนามสกุล
- ส่งข้อมูลการสมัครไปยังห้อง Log

### สิ่งที่ต้องมี

- Node.js 18 ขึ้นไป
- Discord Application และ Bot Token
- เซิร์ฟเวอร์ Discord ที่มีห้องและ Role สำหรับ Whitelist

### ติดตั้ง

1. เปิด Terminal ในโฟลเดอร์โปรเจกต์
2. ติดตั้งแพ็กเกจ:

   ```powershell
   npm install
   ```

   หาก PowerShell บล็อก `npm.ps1` ให้ใช้:

   ```powershell
   npm.cmd install
   ```

3. คัดลอก `.env.example` เป็น `.env`
4. ใส่ Token ของบอทใน `.env`:

   ```env
   DISCORD_TOKEN=ใส่บอทโทเคนตรงนี้
   ```

   ห้ามเผยแพร่ไฟล์ `.env` หรือ Token ใน Git และห้ามนำ Token ไปใส่ใน `config.json`

### ตั้งค่า Discord Bot

สร้าง Bot ได้ที่ [Discord Developer Portal](https://discord.com/developers/applications)

ตอนเชิญบอทเข้าเซิร์ฟเวอร์ ให้เปิด Scopes:

- `bot`
- `applications.commands`

Permissions ที่บอทต้องใช้:

- View Channels
- Send Messages
- Embed Links
- Read Message History
- Manage Roles
- Manage Nicknames

Role ของบอทต้องอยู่สูงกว่า Role Whitelist ในหน้า Server Settings > Roles มิฉะนั้นบอทจะไม่สามารถมอบ Role ได้

### ตั้งค่า `config.json`

ค่าหลักที่ต้องตรวจสอบ:

| ค่า | รายละเอียด |
| --- | --- |
| `guildId` | ID ของเซิร์ฟเวอร์ Discord |
| `setupChannelId` | ID ห้องที่จะส่งปุ่ม Whitelist |
| `commandAccessRoleIds` | รายการ ID ของ Role ที่ใช้ `/setup` ได้ |
| `roleId` | ID ของ Role ที่จะมอบให้ผู้สมัคร |
| `logChannelId` | ID ห้องสำหรับเก็บ Log การสมัคร |
| `modal.fields` | ฟิลด์ข้อมูลที่จะแสดงใน Modal |

เปิด Developer Mode ใน Discord แล้วคลิกขวาที่เซิร์ฟเวอร์ ห้อง หรือ Role เพื่อคัดลอก ID

ตัวอย่างการตั้งค่าฟิลด์:

```json
{
  "id": "steam_hex",
  "label": "Steam Hex ID",
  "placeholder": "steam:110000112345678",
  "style": "Short"
}
```

ค่า `style` ที่รองรับคือ `Short` และ `Paragraph` ตามรูปแบบของ Discord Modal

### เริ่มใช้งาน

รันบอทด้วยคำสั่ง:

```powershell
npm start
```

หาก PowerShell บล็อกสคริปต์ npm ให้ใช้:

```powershell
npm.cmd start
```

เมื่อบอทออนไลน์แล้ว ผู้ใช้ที่มี Role ตาม `commandAccessRoleIds` สามารถใช้คำสั่ง `/setup` ได้ จากนั้นบอทจะส่งปุ่มไปยัง `setupChannelId` หรือห้องที่ใช้คำสั่ง หากไม่ได้กำหนดห้องปลายทาง

ผู้สมัครต้องกรอกข้อมูลตามเงื่อนไขต่อไปนี้:

- ชื่อและนามสกุล IC ต้องขึ้นต้นด้วยตัวพิมพ์ใหญ่และใช้ตัวอักษรภาษาอังกฤษ
- เพศต้องเป็น `ชาย`, `หญิง` หรือ `LGBTQ+`
- อายุต้องเป็นตัวเลขระหว่าง 6 ถึง 100
- Steam Hex ID ต้องอยู่ในรูปแบบ เช่น `steam:110000112345678`
- บัญชี Discord ต้องมีอายุอย่างน้อย 7 วัน

### แก้ปัญหาเบื้องต้น

- `Cannot find module 'dotenv'`: รัน `npm install` หรือ `npm.cmd install`
- `Invalid token`: ตรวจสอบ `DISCORD_TOKEN` ใน `.env` และสร้าง Token ใหม่หาก Token เดิมถูกเปิดเผย
- ใช้ `/setup` ไม่ได้: ตรวจสอบ `commandAccessRoleIds` และสิทธิ์ของสมาชิก
- ส่งข้อความไม่ได้: ตรวจสอบ `setupChannelId` และสิทธิ์ View Channels, Send Messages, Embed Links
- มอบ Role ไม่ได้: ตรวจสอบ `roleId`, สิทธิ์ Manage Roles และลำดับ Role ของบอท
- เปลี่ยน Nickname ไม่ได้: เพิ่มสิทธิ์ Manage Nicknames และตรวจสอบลำดับ Role

## English

### Features

- `/setup` command to post the whitelist application button
- Restrict `/setup` access by Discord role
- Collect application data through a Discord modal
- Support multi-page forms when more than 5 fields are configured
- Validate IC name, IC surname, gender, age, and Steam Hex ID
- Require Discord accounts to be at least 7 days old
- Automatically assign the whitelist role
- Update the member nickname using the IC name and surname
- Send application details to a log channel

### Requirements

- Node.js 18 or newer
- A Discord Application and Bot Token
- A Discord server with configured channels and a whitelist role

### Installation

1. Open a terminal in the project directory.
2. Install dependencies:

   ```powershell
   npm install
   ```

   On Windows, if PowerShell blocks `npm.ps1`, use:

   ```powershell
   npm.cmd install
   ```

3. Copy `.env.example` to `.env`.
4. Add the bot token to `.env`:

   ```env
   DISCORD_TOKEN=your_bot_token_here
   ```

   Never commit `.env` or expose your bot token. Do not put the token in `config.json`.

### Discord Bot Setup

Create the bot in the [Discord Developer Portal](https://discord.com/developers/applications).

When inviting the bot, enable these OAuth2 scopes:

- `bot`
- `applications.commands`

The bot requires these permissions:

- View Channels
- Send Messages
- Embed Links
- Read Message History
- Manage Roles
- Manage Nicknames

Move the bot role above the whitelist role in Server Settings > Roles. Discord role hierarchy prevents the bot from assigning roles above its highest role.

### Configure `config.json`

Check these values:

| Value | Description |
| --- | --- |
| `guildId` | Discord server ID |
| `setupChannelId` | Channel where the whitelist button is posted |
| `commandAccessRoleIds` | Role IDs allowed to use `/setup` |
| `roleId` | Role assigned to approved applicants |
| `logChannelId` | Channel receiving application logs |
| `modal.fields` | Fields displayed in the application modal |

Enable Developer Mode in Discord, then right-click the server, channel, or role to copy its ID.

Example field configuration:

```json
{
  "id": "steam_hex",
  "label": "Steam Hex ID",
  "placeholder": "steam:110000112345678",
  "style": "Short"
}
```

Supported modal styles are `Short` and `Paragraph`.

### Run the Bot

Start the bot with:

```powershell
npm start
```

If PowerShell blocks the npm script, use:

```powershell
npm.cmd start
```

After the bot is online, a member with one of the roles in `commandAccessRoleIds` can run `/setup`. The bot posts the button to `setupChannelId`, or to the command channel when no target channel is configured.

Applicants must meet these validation rules:

- IC name and surname must start with an uppercase English letter and contain English letters only.
- Gender must be `ชาย`, `หญิง`, or `LGBTQ+`.
- Age must be a number from 6 to 100.
- Steam Hex ID must use a format such as `steam:110000112345678`.
- The Discord account must be at least 7 days old.

### Troubleshooting

- `Cannot find module 'dotenv'`: run `npm install` or `npm.cmd install`.
- `Invalid token`: check `DISCORD_TOKEN` in `.env`, and regenerate the token if it was exposed.
- `/setup` is unavailable: check `commandAccessRoleIds` and the member's roles.
- Messages cannot be sent: check `setupChannelId` and the View Channels, Send Messages, and Embed Links permissions.
- The role cannot be assigned: check `roleId`, Manage Roles, and the bot role hierarchy.
- The nickname cannot be changed: grant Manage Nicknames and check the role hierarchy.

## License

This project is private unless a license is added by the project owner.

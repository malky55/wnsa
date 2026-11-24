// تسجيل أوامر السلاش في ديسكورد
// شغّله كده:
//   DISCORD_TOKEN=توكن_البوت DISCORD_APPLICATION_ID=ابلكيشن_ايدي npm run register

import { COMMANDS } from '../src/games/index.js';

const token = process.env.DISCORD_TOKEN;
const appId = process.env.DISCORD_APPLICATION_ID;

if (!token || !appId) {
  console.error('لازم تحدد DISCORD_TOKEN و DISCORD_APPLICATION_ID في متغيرات البيئة.');
  process.exit(1);
}

const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(COMMANDS),
});

const data = await res.json().catch(() => null);
if (!res.ok) {
  console.error('فشل تسجيل الأوامر:', res.status, JSON.stringify(data));
  process.exit(1);
}
console.log('اتسجلت الأوامر بنجاح ✅');
console.log((data || []).map((c) => `- /${c.name}: ${c.description}`).join('\n'));

# Nexus Games Bot 🎮

بوت ألعاب لديسكورد شغال على **Cloudflare Workers** (مجاني)، مع **لوحة تحكم** (موقع) تدير منها السيرفرات والألعاب.

## بيعمل إيه؟

- 🎰 **لعبة الروليت:** البوت يبعت رسالة "الروليت جاهزة"، الناس تدوس **انضم**، واللي بدأ اللفة (أو الأدمن) يدوس **لف** فيختار فايز عشوائي.
- 🧩 **قابل للتوسعة:** أي لعبة جديدة تتضاف كملف واحد في `src/games/` وتتسجل في سطرين.
- 🖥️ **لوحة تحكم:** تسجل دخول بحساب ديسكورد، تشوف السيرفرات اللي انت أدمن فيها والبوت موجود فيها، تختار الروم اللي كل لعبة تشتغل فيه، وتبدأ/تلف/تنهي اللفة من الموقع مباشرة.

## التقنيات

- Cloudflare Workers + KV (تخزين إعدادات السيرفرات وحالة اللفات)
- Discord Interactions (سلاش كوماندز + أزرار) — البوت مش محتاج Gateway ولا سيرفر شغال ٢٤ ساعة
- Discord OAuth2 لتسجيل الدخول في لوحة التحكم

---

## التشغيل خطوة بخطوة

### 1) أنشئ تطبيق ديسكورد

1. افتح https://discord.com/developers/applications واعمل **New Application**.
2. من صفحة **General Information** خد:
   - **Application ID**
   - **Public Key**
3. من صفحة **Bot** اعمل **Reset Token** وخد **Bot Token** (متتشاركش مع حد).
4. من صفحة **OAuth2** → **Redirects** ضيف:
   ```
   https://nexus-games-bot.<اسم-حسابك>.workers.dev/auth/callback
   ```
   (هتعرف الرابط بالظبط بعد خطوة الديبلوي، ساعتها ارجع ضيفه).

### 2) جهّز المشروع

```bash
npm install
npx wrangler login
```

### 3) أنشئ مساحة التخزين (KV)

```bash
npx wrangler kv namespace create CONFIG
```

هيطلعلك سطر فيه `id = "..."` — حطه مكان `PUT_KV_NAMESPACE_ID_HERE` في `wrangler.toml`.

### 4) حط الإعدادات

- في `wrangler.toml`: حط الـ **Application ID** مكان `PUT_APPLICATION_ID_HERE`.
- سجّل الأسرار (كل أمر هيسألك تكتب القيمة):

```bash
npx wrangler secret put DISCORD_TOKEN          # توكن البوت
npx wrangler secret put DISCORD_PUBLIC_KEY     # الـ Public Key
npx wrangler secret put DISCORD_CLIENT_SECRET  # من صفحة OAuth2 -> Client Secret
npx wrangler secret put SESSION_SECRET         # أي نص عشوائي طويل من عندك
```

### 5) انشر البوت

```bash
npx wrangler deploy
```

هيطلعلك رابط زي:
`https://nexus-games-bot.<اسم-حسابك>.workers.dev`

- ارجع لصفحة **General Information** في ديسكورد وحط في **Interactions Endpoint URL**:
  ```
  https://nexus-games-bot.<اسم-حسابك>.workers.dev/interactions
  ```
  لو رفض يحفظ، تأكد إن `DISCORD_PUBLIC_KEY` صح.
- وارجع ضيف رابط الـ OAuth2 Redirect زي خطوة 1 لو لسه.

### 6) سجّل أوامر السلاش

```bash
DISCORD_TOKEN=توكن_البوت DISCORD_APPLICATION_ID=ابلكيشن_ايدي npm run register
```

### 7) ضيف البوت لسيرفرك

افتح اللينك ده (بدّل الـ ID):

```
https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&scope=bot%20applications.commands&permissions=84992
```

### 8) جرّب

- في ديسكورد: اكتب `/roulette` في أي روم.
- من لوحة التحكم: افتح رابط الـ Worker، سجل دخول بديسكورد، اختار السيرفر، حدد الروم، وابدأ لفة من الموقع.

---

## ترفعه على GitHub

```bash
git init
git add .
git commit -m "Nexus Games bot + dashboard"
git branch -M main
git remote add origin https://github.com/USERNAME/nexus-games-bot.git
git push -u origin main
```

> ⚠️ متعملش كوميت لأي توكن أو سيكريت. كل الأسرار بتتسجل بـ `wrangler secret` ومش موجودة في الكود.

## تضيف لعبة جديدة؟

1. اعمل ملف جديد في `src/games/` زي `roulette.js` بنفس الواجهة.
2. ضيفه في `src/games/index.js` في `GAMES` و `COMMANDS`.
3. `npm run register` و `npx wrangler deploy`.

## حاجات تستاهل التطوير بعدين

- ألعاب جديدة (XO، حجرة ورقة مقص، تخمين).
- جوايز ونقاط لكل لاعب.
- Cloudflare Pages للوحة التحكم بدل ما هي جوه الـ Worker (الحالي أبسط وشغال).

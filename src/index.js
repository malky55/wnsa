import { verifyDiscordRequest } from './verify.js';
import { botApi, userApi, exchangeCode, botInviteUrl } from './discord.js';
import { createSession, readSession, sessionCookieHeader } from './session.js';
import { getGame, listGames } from './games/index.js';
import { dashboardHtml, loginHtml } from './dashboard.js';

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const html = (body, headers = {}) =>
  new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });

const gameKey = (guildId, channelId, gameId) => `game:${guildId}:${channelId}:${gameId}`;
const guildCfgKey = (guildId) => `guildcfg:${guildId}`;

async function getGuildConfig(env, guildId) {
  const raw = await env.CONFIG.get(guildCfgKey(guildId));
  if (!raw) return { rooms: {} };
  try {
    return JSON.parse(raw);
  } catch {
    return { rooms: {} };
  }
}

// ---------- Interactions (سلاش كوماندز + أزرار) ----------

async function startRound(env, interaction, game) {
  const guildId = interaction.guild_id;
  const channelId = interaction.channel_id;
  const cfg = await getGuildConfig(env, guildId);
  const room = cfg.rooms && cfg.rooms[game.id];
  if (room && room !== channelId) {
    return json({
      type: 4,
      data: {
        content: `${game.emoji} لعبة ${game.nameAr} شغالة في روم <#${room}> بس. تقدر تغير الروم من لوحة التحكم.`,
        flags: 64,
      },
    });
  }
  const key = gameKey(guildId, channelId, game.id);
  const existing = await env.CONFIG.get(key);
  if (existing) {
    try {
      if (JSON.parse(existing).status === 'open') {
        return json({
          type: 4,
          data: { content: 'في لفة شغالة بالفعل هنا. خلصها الأول (لف 🎲 أو إنهاء ✖️).', flags: 64 },
        });
      }
    } catch {
      // state بايظ، هنبدأ من جديد
    }
  }
  const state = game.newState(interaction.member);
  await env.CONFIG.put(key, JSON.stringify(state));
  return json({ type: 4, data: game.render(state) });
}

async function handleComponent(env, interaction) {
  const [gameId, action] = String(interaction.data.custom_id || '').split(':');
  const game = getGame(gameId);
  if (!game) {
    return json({ type: 4, data: { content: 'لعبة غير معروفة.', flags: 64 } });
  }
  const key = gameKey(interaction.guild_id, interaction.channel_id, gameId);
  const raw = await env.CONFIG.get(key);
  if (!raw) {
    return json({ type: 4, data: { content: 'مفيش لفة شغالة هنا.', flags: 64 } });
  }
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    await env.CONFIG.delete(key);
    return json({ type: 4, data: { content: 'حصلت مشكلة في اللفة، ابدأ لفة جديدة.', flags: 64 } });
  }
  const result = await game.onComponent(state, action, interaction.member);
  if (result.reply) return json(result.reply);
  if (result.cancelled) {
    await env.CONFIG.delete(key);
    return json({ type: 7, data: game.cancelledPayload() });
  }
  await env.CONFIG.put(key, JSON.stringify(result.state));
  return json({ type: 7, data: game.render(result.state) });
}

async function handleInteraction(request, env) {
  const { isValid, body } = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
  if (!isValid) return new Response('invalid request signature', { status: 401 });

  const interaction = JSON.parse(body);

  if (interaction.type === 1) return json({ type: 1 }); // PING -> PONG

  if (interaction.type === 2) {
    // APPLICATION_COMMAND
    const name = interaction.data.name;
    if (name === 'games') {
      const lines = listGames()
        .map((g) => `${g.emoji} **${g.nameAr}** (${g.name}) — ${g.description}`)
        .join('\n');
      return json({
        type: 4,
        data: { content: `🎮 **الألعاب المتاحة:**\n${lines}`, flags: 64 },
      });
    }
    const game = getGame(name);
    if (!game) {
      return json({ type: 4, data: { content: 'أمر غير معروف.', flags: 64 } });
    }
    return startRound(env, interaction, game);
  }

  if (interaction.type === 3) {
    // MESSAGE_COMPONENT (أزرار)
    return handleComponent(env, interaction);
  }

  return json({ type: 4, data: { content: 'نوع تفاعل غير مدعوم.', flags: 64 } });
}

// ---------- OAuth ----------

function handleLogin(request, env, url) {
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/auth/callback`;
  const target =
    'https://discord.com/oauth2/authorize?client_id=' +
    env.DISCORD_APPLICATION_ID +
    '&redirect_uri=' +
    encodeURIComponent(redirectUri) +
    '&response_type=code&scope=identify%20guilds&state=' +
    state;
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Set-Cookie': `nx_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

async function handleCallback(request, env, url) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/nx_oauth_state=([^;]+)/);
  if (!code || !state || !m || m[1] !== state) {
    return html('<p dir="rtl">فشل تسجيل الدخول، جرب تاني.</p>', { status: 400 });
  }
  const redirectUri = `${url.origin}/auth/callback`;
  const tokenData = await exchangeCode(env, code, redirectUri);
  const [me, guilds] = await Promise.all([
    userApi(tokenData.access_token, '/users/@me'),
    userApi(tokenData.access_token, '/users/@me/guilds'),
  ]);
  const adminGuilds = {};
  for (const g of guilds || []) {
    let isAdmin = !!g.owner;
    if (!isAdmin) {
      try {
        isAdmin = (BigInt(g.permissions || '0') & 0x20n) !== 0n;
      } catch {
        isAdmin = false;
      }
    }
    if (isAdmin) adminGuilds[g.id] = true;
  }
  const sessionVal = await createSession(env, {
    user: { id: me.id, username: me.global_name || me.username, avatar: me.avatar },
    accessToken: tokenData.access_token,
    adminGuilds,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': sessionCookieHeader(sessionVal),
    },
  });
}

function handleLogout() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': sessionCookieHeader('deleted', 0),
    },
  });
}

// ---------- لوحة التحكم (API) ----------

async function assertGuildAccess(env, session, guildId) {
  if (!session.adminGuilds || !session.adminGuilds[guildId]) {
    throw Object.assign(new Error('مش أدمن في السيرفر ده.'), { status: 403 });
  }
  try {
    await botApi(env, `/guilds/${guildId}`);
  } catch (e) {
    throw Object.assign(new Error('البوت مش موجود في السيرفر ده. ضيفه الأول.'), {
      status: 400,
    });
  }
}

async function loadRound(env, guildId, gameId) {
  const cfg = await getGuildConfig(env, guildId);
  const room = cfg.rooms && cfg.rooms[gameId];
  if (!room) {
    throw Object.assign(new Error('اختار الروم اللي اللعبة هتشتغل فيه الأول.'), { status: 400 });
  }
  const raw = await env.CONFIG.get(gameKey(guildId, room, gameId));
  let round = null;
  if (raw) {
    try {
      round = JSON.parse(raw);
    } catch {
      round = null;
    }
  }
  return { room, round, key: gameKey(guildId, room, gameId) };
}

async function handleApi(request, env, url) {
  const session = await readSession(request, env);
  if (!session) return json({ error: 'سجل دخول الأول.' }, 401);
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const method = request.method;

  if (parts[1] === 'games' && parts.length === 2 && method === 'GET') {
    return json({ games: listGames(), inviteUrl: botInviteUrl(env) });
  }

  if (parts[1] === 'guilds' && parts.length === 2 && method === 'GET') {
    const botGuilds = await botApi(env, '/users/@me/guilds');
    const botIds = new Set((botGuilds || []).map((g) => g.id));
    const userGuilds = await userApi(session.accessToken, '/users/@me/guilds');
    const mutual = (userGuilds || [])
      .filter((g) => botIds.has(g.id) && session.adminGuilds && session.adminGuilds[g.id])
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
      }));
    return json(mutual);
  }

  if (parts[1] === 'guilds' && parts.length >= 3) {
    const guildId = parts[2];
    await assertGuildAccess(env, session, guildId);

    if (parts[3] === 'channels' && method === 'GET') {
      const channels = await botApi(env, `/guilds/${guildId}/channels`);
      return json(
        (channels || [])
          .filter((c) => c.type === 0 || c.type === 5)
          .map((c) => ({ id: c.id, name: c.name }))
      );
    }

    if (parts[3] === 'config') {
      if (method === 'GET') return json(await getGuildConfig(env, guildId));
      if (method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        const rooms = {};
        for (const g of listGames()) {
          const v = body.rooms && body.rooms[g.id];
          rooms[g.id] = typeof v === 'string' && v ? v : null;
        }
        await env.CONFIG.put(guildCfgKey(guildId), JSON.stringify({ rooms }));
        return json({ ok: true, rooms });
      }
    }

    if (parts[3] === 'games' && parts.length >= 5) {
      const game = getGame(parts[4]);
      if (!game) return json({ error: 'لعبة غير معروفة' }, 404);
      const { room, round, key } = await loadRound(env, guildId, game.id);

      if (parts[5] === 'state' && method === 'GET') {
        return json({ round });
      }

      if (parts[5] === 'start' && method === 'POST') {
        if (round && round.status === 'open') {
          return json({ error: 'في لفة شغالة بالفعل.' }, 409);
        }
        const state = game.newState(null, {
          id: session.user.id,
          username: session.user.username,
        });
        const msg = await botApi(env, `/channels/${room}/messages`, {
          method: 'POST',
          body: game.render(state),
        });
        state.messageId = msg && msg.id;
        await env.CONFIG.put(key, JSON.stringify(state));
        return json({ ok: true });
      }

      if (parts[5] === 'spin' && method === 'POST') {
        if (!round || round.status !== 'open') return json({ error: 'مفيش لفة مفتوحة.' }, 400);
        if (round.players.length < 2) return json({ error: 'محتاجين لاعبين على الأقل.' }, 400);
        const winner = round.players[Math.floor(Math.random() * round.players.length)];
        round.status = 'done';
        round.winner = winner;
        await env.CONFIG.put(key, JSON.stringify(round));
        if (round.messageId) {
          await botApi(env, `/channels/${room}/messages/${round.messageId}`, {
            method: 'PATCH',
            body: game.render(round),
          });
        } else {
          await botApi(env, `/channels/${room}/messages`, {
            method: 'POST',
            body: game.render(round),
          });
        }
        return json({ ok: true, winner });
      }

      if (parts[5] === 'end' && method === 'POST') {
        if (!round) return json({ error: 'مفيش لفة شغالة.' }, 400);
        await env.CONFIG.delete(key);
        if (round.messageId) {
          await botApi(env, `/channels/${room}/messages/${round.messageId}`, {
            method: 'PATCH',
            body: game.cancelledPayload(),
          });
        } else {
          await botApi(env, `/channels/${room}/messages`, {
            method: 'POST',
            body: game.cancelledPayload(),
          });
        }
        return json({ ok: true });
      }
    }
  }

  return json({ error: 'Not found' }, 404);
}

// ---------- الراوتر الرئيسي ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/interactions' && request.method === 'POST') {
        return await handleInteraction(request, env);
      }
      if (path === '/' && request.method === 'GET') {
        const session = await readSession(request, env);
        if (!session) {
          return html(loginHtml(`/auth/login`));
        }
        return html(dashboardHtml(session.user));
      }
      if (path === '/auth/login') return handleLogin(request, env, url);
      if (path === '/auth/callback') return await handleCallback(request, env, url);
      if (path === '/auth/logout') return handleLogout();
      if (path.startsWith('/api/')) {
        const res = await handleApi(request, env, url);
        return res;
      }
      return new Response('Not found', { status: 404 });
    } catch (e) {
      if (url.pathname.startsWith('/api/')) {
        return json({ error: e.message || 'خطأ داخلي' }, e.status || 500);
      }
      return new Response('Error: ' + (e.message || 'internal'), { status: 500 });
    }
  },
};

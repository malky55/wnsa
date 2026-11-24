const API = 'https://discord.com/api/v10';

async function call(path, { method = 'GET', token, bot = false, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: bot ? `Bot ${token}` : `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const err = new Error(`Discord API ${method} ${path} -> ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// نداءات بصلاحية البوت
export const botApi = (env, path, opts = {}) =>
  call(path, { ...opts, token: env.DISCORD_TOKEN, bot: true });

// نداءات بصلاحية المستخدم (OAuth)
export const userApi = (token, path, opts = {}) =>
  call(path, { ...opts, token });

// استبدال كود الـ OAuth بتوكن
export async function exchangeCode(env, code, redirectUri) {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_APPLICATION_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error('OAuth code exchange failed');
  }
  return data;
}

// رابط دعوة البوت لأي سيرفر (Send Messages + Embed Links + Read History + View Channel)
export function botInviteUrl(env) {
  return (
    'https://discord.com/oauth2/authorize?client_id=' +
    env.DISCORD_APPLICATION_ID +
    '&scope=bot%20applications.commands&permissions=84992'
  );
}

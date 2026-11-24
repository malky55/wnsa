// جلسات لوحة التحكم: كوكي موقّع بـ HMAC وبياناته متخزنة في KV

const encoder = new TextEncoder();

export async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(env, data) {
  const id = crypto.randomUUID();
  await env.CONFIG.put(`sess:${id}`, JSON.stringify(data), {
    expirationTtl: 60 * 60 * 24 * 7,
  });
  const sig = await hmac(env.SESSION_SECRET, id);
  return `${id}.${sig}`;
}

export function sessionCookieHeader(value, maxAge = 60 * 60 * 24 * 7) {
  return `nx_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function readSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/nx_session=([^;]+)/);
  if (!m) return null;
  const dot = m[1].lastIndexOf('.');
  if (dot === -1) return null;
  const id = m[1].slice(0, dot);
  const sig = m[1].slice(dot + 1);
  const expected = await hmac(env.SESSION_SECRET, id);
  if (expected !== sig) return null;
  const raw = await env.CONFIG.get(`sess:${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

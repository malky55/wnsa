// صفحات لوحة التحكم (HTML/CSS/JS مضمّنين في الـ Worker)

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    direction: rtl;
    min-height: 100vh;
  }
  .container { max-width: 900px; margin: 0 auto; padding: 24px 16px 60px; }
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 0; border-bottom: 1px solid #21262d; margin-bottom: 24px;
  }
  .brand { font-size: 20px; font-weight: 700; }
  .brand span { color: #9b59b6; }
  .userbox { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .userbox img { width: 32px; height: 32px; border-radius: 50%; }
  a.btn, button.btn {
    display: inline-block; background: #9b59b6; color: #fff; border: 0;
    padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;
    cursor: pointer; text-decoration: none; transition: opacity .15s;
  }
  a.btn:hover, button.btn:hover { opacity: .85; }
  button.btn:disabled { opacity: .4; cursor: not-allowed; }
  .btn.ghost { background: #21262d; }
  .btn.green { background: #2ea043; }
  .btn.red { background: #da3633; }
  .card {
    background: #161b22; border: 1px solid #21262d; border-radius: 12px;
    padding: 18px; margin-bottom: 16px;
  }
  .card h3 { font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .guild-head { display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .guild-head img { width: 40px; height: 40px; border-radius: 10px; }
  .guild-head .icon-fallback {
    width: 40px; height: 40px; border-radius: 10px; background: #9b59b6;
    display: flex; align-items: center; justify-content: center; font-weight: 700;
  }
  .muted { color: #7d8590; font-size: 13px; }
  select {
    background: #0d1117; color: #e6edf3; border: 1px solid #30363d;
    border-radius: 8px; padding: 8px 10px; font-size: 14px; min-width: 220px;
  }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 10px 0; }
  .game-box { border-top: 1px dashed #30363d; padding-top: 12px; margin-top: 12px; }
  .players { font-size: 14px; line-height: 1.9; margin: 8px 0; }
  .pill {
    display: inline-block; background: #21262d; border-radius: 999px;
    padding: 2px 12px; font-size: 12px; margin-inline-start: 8px;
  }
  .pill.open { background: #2ea04333; color: #3fb950; }
  .pill.done { background: #f1c40f33; color: #f1c40f; }
  .toast {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: #21262d; border: 1px solid #30363d; padding: 10px 20px;
    border-radius: 8px; font-size: 14px; display: none; z-index: 50;
  }
  .hero { text-align: center; padding: 80px 20px; }
  .hero h1 { font-size: 34px; margin-bottom: 12px; }
  .hero h1 span { color: #9b59b6; }
  .hero p { color: #7d8590; margin-bottom: 28px; }
  .empty { text-align: center; padding: 40px 0; color: #7d8590; }
`;

export function loginHtml(loginUrl) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nexus Games - لوحة التحكم</title>
<style>${BASE_CSS}</style>
</head>
<body>
  <div class="hero">
    <h1>🎮 Nexus <span>Games</span></h1>
    <p>بوت ألعاب لديسكورد مع لوحة تحكم كاملة: اختار الروم، ابدأ اللفة، ولف من مكانك.</p>
    <a class="btn" href="${loginUrl}">سجل دخول بحساب ديسكورد</a>
  </div>
</body>
</html>`;
}

export function dashboardHtml(user) {
  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nexus Games - لوحة التحكم</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="container">
  <div class="topbar">
    <div class="brand">🎮 Nexus <span>Games</span></div>
    <div class="userbox">
      <img src="${avatar}" alt="">
      <span>${escapeHtml(user.username)}</span>
      <a class="btn ghost" href="/auth/logout">خروج</a>
    </div>
  </div>
  <div id="app"><div class="empty">بنحمّل السيرفرات...</div></div>
</div>
<div class="toast" id="toast"></div>
<script>
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
let GAMES = [];

function toast(msg, ok = true) {
  toastEl.textContent = msg;
  toastEl.style.borderColor = ok ? '#2ea043' : '#da3633';
  toastEl.style.display = 'block';
  setTimeout(() => (toastEl.style.display = 'none'), 3000);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('خطأ ' + res.status));
  return data;
}

function guildIcon(g) {
  return g.icon
    ? '<img src="' + g.icon + '" alt="">'
    : '<div class="icon-fallback">' + (g.name || '?').charAt(0) + '</div>';
}

function stateLabel(st) {
  if (!st) return '<span class="pill">مفيش لفة شغالة</span>';
  if (st.status === 'done' && st.winner)
    return '<span class="pill done">خلصت — الفايز ' + escapeHtml(st.winner.name) + '</span>';
  return '<span class="pill open">مفتوحة — ' + st.players.length + ' لاعب</span>';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderGuild(g) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML =
    '<div class="guild-head">' + guildIcon(g) +
    '<div><div style="font-weight:700">' + escapeHtml(g.name) + '</div>' +
    '<div class="muted">ID: ' + g.id + '</div></div></div>' +
    '<div class="games-area" style="display:none"></div>';
  const area = card.querySelector('.games-area');
  card.querySelector('.guild-head').onclick = () => {
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
    if (area.dataset.loaded !== '1') loadGuild(g.id, area);
  };
  return card;
}

async function loadGuild(gid, area) {
  try {
    const [cfg, channels] = await Promise.all([
      api('/api/guilds/' + gid + '/config'),
      api('/api/guilds/' + gid + '/channels'),
    ]);
    area.innerHTML = '';
    for (const game of GAMES) {
      const box = document.createElement('div');
      box.className = 'game-box';
      const roomId = (cfg.rooms && cfg.rooms[game.id]) || '';
      const opts = ['<option value="">— اختار الروم —</option>']
        .concat(channels.map((c) =>
          '<option value="' + c.id + '"' + (c.id === roomId ? ' selected' : '') + '># ' +
          escapeHtml(c.name) + '</option>'))
        .join('');
      box.innerHTML =
        '<h3>' + game.emoji + ' ' + escapeHtml(game.nameAr) +
        ' <span class="state-slot"></span></h3>' +
        '<div class="row"><select class="room-select">' + opts + '</select>' +
        '<button class="btn ghost save-room">حفظ الروم</button></div>' +
        '<div class="players"></div>' +
        '<div class="row">' +
        '<button class="btn green act" data-a="start">ابدأ لفة</button>' +
        '<button class="btn act" data-a="spin">لف 🎲</button>' +
        '<button class="btn red act" data-a="end">إنهاء</button>' +
        '<button class="btn ghost refresh">تحديث</button></div>';
      area.appendChild(box);

      box.querySelector('.save-room').onclick = async (e) => {
        e.target.disabled = true;
        try {
          const rooms = Object.assign({}, cfg.rooms);
          rooms[game.id] = box.querySelector('.room-select').value || null;
          await api('/api/guilds/' + gid + '/config', { method: 'PUT', body: { rooms } });
          cfg.rooms = rooms;
          toast('اتحفظ الروم ✅');
          refreshState();
        } catch (err) { toast(err.message, false); }
        e.target.disabled = false;
      };

      box.querySelectorAll('.act').forEach((b) => {
        b.onclick = async () => {
          b.disabled = true;
          try {
            await api('/api/guilds/' + gid + '/games/' + game.id + '/' + b.dataset.a, { method: 'POST' });
            toast(b.dataset.a === 'start' ? 'اللفة بدأت 🎰' : b.dataset.a === 'spin' ? 'اللفة خلصت، شوف الفايز 🏆' : 'اللفة اتقفلت');
          } catch (err) { toast(err.message, false); }
          b.disabled = false;
          refreshState();
        };
      });

      async function refreshState() {
        try {
          const st = await api('/api/guilds/' + gid + '/games/' + game.id + '/state');
          box.querySelector('.state-slot').innerHTML = stateLabel(st.round);
          box.querySelector('.players').innerHTML =
            st.round && st.round.players && st.round.players.length
              ? st.round.players.map((p, i) => (i + 1) + '. ' + escapeHtml(p.name)).join('<br>')
              : '';
        } catch (err) { /* غرفة مش مختارة لسه */ }
      }
      box.querySelector('.refresh').onclick = refreshState;
      refreshState();
    }
    area.dataset.loaded = '1';
  } catch (err) {
    area.innerHTML = '<div class="empty">' + escapeHtml(err.message) + '</div>';
  }
}

(async () => {
  try {
    const [gamesRes, guilds] = await Promise.all([api('/api/games'), api('/api/guilds')]);
    GAMES = gamesRes.games;
    if (!guilds.length) {
      app.innerHTML =
        '<div class="card empty">مفيش سيرفر مشترك بينك وبين البوت (ولازم تكون أدمن فيه).<br><br>' +
        '<a class="btn" href="' + gamesRes.inviteUrl + '">ضيف البوت لسيرفرك</a></div>';
      return;
    }
    app.innerHTML = '';
    for (const g of guilds) app.appendChild(await renderGuild(g));
  } catch (err) {
    app.innerHTML = '<div class="empty">' + escapeHtml(err.message) + '</div>';
  }
})();
</script>
</body>
</html>`;
}

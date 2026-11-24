// لعبة الروليت: الكل يدخل بزرار، واللي بدأ اللفة (أو أدمن) يلف، والبوت يختار فايز عشوائي.

function ephemeral(content) {
  return { type: 4, data: { content, flags: 64 } };
}

function displayName(user, member) {
  return (member && member.nick) || user.global_name || user.username;
}

function hasManageGuild(member) {
  try {
    return (BigInt(member.permissions || '0') & 0x20n) !== 0n;
  } catch {
    return false;
  }
}

export const roulette = {
  id: 'roulette',
  name: 'Roulette',
  nameAr: 'الروليت',
  emoji: '🎰',
  description: 'لفة حظ: الكل يدخل، والبوت يختار فايز عشوائي.',

  newState(member, user) {
    const u = user || member.user;
    return {
      status: 'open',
      players: [],
      winner: null,
      startedBy: { id: u.id, name: displayName(u, member) },
      messageId: null,
    };
  },

  render(state) {
    if (state.status === 'done' && state.winner) {
      return {
        embeds: [
          {
            title: '🎰 الروليت',
            description: `اللفة خلصت!\n\n🏆 **الفايز: <@${state.winner.id}>**\n\nلفة جديدة؟ اكتب \`/roulette\` أو ابدأها من لوحة التحكم.`,
            color: 0xf1c40f,
            footer: { text: `${state.players.length} لاعب اشترك في اللفة` },
          },
        ],
        components: [],
      };
    }
    const players = state.players.length
      ? state.players.map((p, i) => `${i + 1}. <@${p.id}>`).join('\n')
      : 'لسه محدش دخل.. كون أول واحد!';
    return {
      embeds: [
        {
          title: '🎰 الروليت جاهزة!',
          description: `اللي عايز يدخل اللفة يدوس **انضم**.\n\n**اللاعبين (${state.players.length}):**\n${players}`,
          color: 0x9b59b6,
          footer: { text: `بدأها ${state.startedBy.name} • محتاجين لاعبين على الأقل عشان اللفة` },
        },
      ],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 1, label: 'انضم 🎫', custom_id: 'roulette:join' },
            { type: 2, style: 3, label: 'لف 🎲', custom_id: 'roulette:spin' },
            { type: 2, style: 4, label: 'إنهاء ✖️', custom_id: 'roulette:end' },
          ],
        },
      ],
    };
  },

  cancelledPayload() {
    return {
      embeds: [
        {
          title: '🎰 الروليت',
          description: 'اللفة اتقفلت. ابدأ لفة جديدة بـ `/roulette`',
          color: 0x95a5a6,
        },
      ],
      components: [],
    };
  },

  // بيرجع: { state, update } لتعديل الرسالة، أو { state, reply } لرد مخفي،
  // أو { state: null, cancelled: true, update: true } لإنهاء اللفة
  async onComponent(state, action, member) {
    const uid = member.user.id;
    const isHost = state.startedBy.id === uid || hasManageGuild(member);

    if (action === 'join') {
      if (state.status !== 'open') {
        return { state, reply: ephemeral('اللفة دي خلصت خلاص.') };
      }
      if (state.players.some((p) => p.id === uid)) {
        return { state, reply: ephemeral('انت داخل اللفة أصلاً 😅') };
      }
      state.players.push({ id: uid, name: displayName(member.user, member) });
      return { state, update: true };
    }

    if (action === 'spin') {
      if (!isHost) {
        return { state, reply: ephemeral('اللف للي بدأ اللفة أو للأدمن بس.') };
      }
      if (state.status !== 'open') {
        return { state, reply: ephemeral('اللفة دي خلصت خلاص.') };
      }
      if (state.players.length < 2) {
        return { state, reply: ephemeral('محتاجين لاعبين على الأقل عشان اللفة 🎲') };
      }
      const winner = state.players[Math.floor(Math.random() * state.players.length)];
      state.status = 'done';
      state.winner = winner;
      return { state, update: true };
    }

    if (action === 'end') {
      if (!isHost) {
        return { state, reply: ephemeral('الإنهاء للي بدأ اللفة أو للأدمن بس.') };
      }
      return { state: null, update: true, cancelled: true };
    }

    return { state, reply: ephemeral('حاجة غلط حصلت، جرب تاني.') };
  },
};

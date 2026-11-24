// سجل الألعاب: أي لعبة جديدة تتضاف هنا بس.
// اعمل ملف جديد جنب roulette.js بنفس الواجهة
// (id, name, nameAr, emoji, description, newState, render, onComponent, cancelledPayload)
// وزوّده في GAMES وفي COMMANDS، وبعدين شغّل: npm run register

import { roulette } from './roulette.js';

export const GAMES = {
  [roulette.id]: roulette,
};

// أوامر السلاش اللي بتتسجل في ديسكورد
export const COMMANDS = [
  { name: 'roulette', description: 'ابدأ لفة روليت جديدة 🎰' },
  { name: 'games', description: 'شوف الألعاب المتاحة 🎮' },
];

export function getGame(id) {
  return GAMES[id] || null;
}

export function listGames() {
  return Object.values(GAMES).map((g) => ({
    id: g.id,
    name: g.name,
    nameAr: g.nameAr,
    emoji: g.emoji,
    description: g.description,
  }));
}

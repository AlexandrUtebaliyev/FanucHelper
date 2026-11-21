import { TF } from './tf.js';
import { MF } from './mf.js';

export const PROFILES = { TF, MF };
export const profileOf = (id) => PROFILES[id] || TF;
export function findModule(screen) {
  for (const p of Object.values(PROFILES)) if (p.modules.some((m) => m.id === screen)) return true;
  return ['backplot', 'backplotmf', 'program', 'settings', 'library'].includes(screen);
}

// Cardul „Boți”: pornit/oprit, stiluri gata făcute și toate setările, grupate.
// Câmpurile se construiesc din shared/sim.ts (limite, pași, valori implicite), deci nu se dublează nimic aici.

import { GIFT_CATALOG } from '../../../shared/gifts';
import { SIM_FIELDS, SIM_PRESETS, simDefaults, type SimNumberKey, type SimSettings } from '../../../shared/sim';
import { batcher, numberControl, selectControl, type NumberControl } from './controls';

export const GROUPS: { titleKey: string; keys: SimNumberKey[] }[] = [
  { titleKey: 'bots.groupCrowd', keys: ['viewers', 'joinsPerSec', 'churnPerMin', 'activePct'] },
  { titleKey: 'bots.groupActivity', keys: ['activity', 'burstiness', 'commentsPerSec', 'likesPerSec', 'likeBurstMax'] },
  { titleKey: 'bots.groupChat', keys: ['movePct', 'modeCmdPct', 'votePct', 'voteFor', 'votePushPct', 'pvpTopPct'] },
  { titleKey: 'bots.groupGifts', keys: ['giftsPerMin', 'giftMaxDiamonds', 'giftStreakMax', 'voteGiftPct'] },
  { titleKey: 'bots.groupFollowers', keys: ['followerPct', 'followsPerMin'] },
];

const UNITS: Partial<Record<SimNumberKey, string>> = {
  activePct: '%', activity: '%', burstiness: '%', movePct: '%', modeCmdPct: '%', votePct: '%',
  votePushPct: '%', pvpTopPct: '%', voteGiftPct: '%', followerPct: '%',
  joinsPerSec: '/s', commentsPerSec: '/s', likesPerSec: '/s',
  churnPerMin: '/min', giftsPerMin: '/min', followsPerMin: '/min',
};

/** Numele unui cadou cu exact atâtea diamante, ca lista de prețuri să spună ceva („30 💎 · Doughnut”). */
const giftAt = (d: number) => GIFT_CATALOG.find((g) => g.diamonds === d)?.name;

export function setupBots(root: HTMLElement, send: (patch: Partial<SimSettings>) => void): (s: SimSettings) => void {
  const queue = batcher<SimSettings>(send);
  const controls = new Map<SimNumberKey, NumberControl>();

  const enabled = root.querySelector<HTMLInputElement>('#sim-enabled')!;
  enabled.addEventListener('change', () => send({ enabled: enabled.checked }));

  // Stiluri gata făcute + întoarcerea la valorile de bază.
  const presets = root.querySelector<HTMLElement>('#bot-presets')!;
  for (const p of SIM_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i18n = `bots.preset.${p.id}`;
    b.addEventListener('click', () => send(p.values));
    presets.append(b);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'subtle';
  reset.dataset.i18n = 'bots.reset';
  reset.addEventListener('click', () => {
    const { enabled: _keep, ...defs } = simDefaults(true);
    send(defs);
  });
  presets.append(reset);

  const groupsBox = root.querySelector<HTMLElement>('#bot-groups')!;
  for (const g of GROUPS) {
    const fs = document.createElement('fieldset');
    fs.className = 'group';
    const legend = document.createElement('legend');
    legend.dataset.i18n = g.titleKey;
    fs.append(legend);
    for (const key of g.keys) {
      const f = SIM_FIELDS[key];
      const onChange = (value: number) => queue({ [key]: value } as Partial<SimSettings>);
      const common = { id: `bot-${key}`, labelKey: `bots.${key}`, hintKey: `bots.${key}Hint`, onChange };
      const control = f.options
        ? selectControl({
            ...common,
            options: f.options.map((v) =>
              key === 'voteFor'
                ? { value: v, labelKey: `bots.voteFor${v}` }
                : { value: v, text: `${v} 💎${giftAt(v) ? ` · ${giftAt(v)}` : ''}` },
            ),
          })
        : numberControl({ ...common, min: f.min, max: f.max, step: f.step, unit: UNITS[key] });
      controls.set(key, control);
      fs.append(control.el);
    }
    groupsBox.append(fs);
  }

  return (s: SimSettings) => {
    enabled.checked = s.enabled;
    root.classList.toggle('off', !s.enabled);
    for (const [key, c] of controls) c.set(s[key]);
  };
}

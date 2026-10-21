import { describe, expect, it } from 'vitest';
// The look of the driving HUD (SHOWCASE_PLAN §12, R2): dark glass panels, white text of at least 1 rem, one cyan accent,
// amber for warnings. Checked on the style sheets themselves, so a later edit cannot quietly bring back small grey text.

import { readFileSync } from 'node:fs';

const screens = readFileSync(new URL('./screens.css', import.meta.url), 'utf8');
const root = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

interface Rule {
  selector: string;
  body: string;
}
const rules = (css: string): Rule[] => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]!.trim() }));
const HUD_CLASSES = ['.hud2', '.speed-big', '.time-big', '.speed-unit', '.speed-kmh', '.badges', '.badge.slip', '.badge.reverse', '.level-name', '.progress-text', '.score-text', '.popup', '.card', '.place-toast', '.hud2-hint'];
const hudRules = () =>
  rules(screens).filter((r) => r.selector.split(',').some((s) => HUD_CLASSES.some((c) => s.trim() === c || s.trim().startsWith(`${c} `) || s.trim().startsWith(`${c}.`) || s.trim().startsWith(`${c}-`))));

const sizesIn = (body: string): number[] => {
  const out: number[] = [];
  for (const m of body.matchAll(/font-size:\s*([\d.]+)(rem|px)/g)) out.push(m[2] === 'px' ? Number(m[1]) / 16 : Number(m[1]));
  for (const m of body.matchAll(/font:\s*(?:[\d]+\s+)?(?:italic\s+)?([\d.]+)(rem|px)/g)) out.push(m[2] === 'px' ? Number(m[1]) / 16 : Number(m[1]));
  return out;
};

describe('the driving HUD style (R2)', () => {
  it('has rules for the HUD classes', () => {
    expect(hudRules().length).toBeGreaterThan(15);
  });

  it('never sets text smaller than 1 rem', () => {
    let checked = 0;
    for (const r of hudRules()) {
      for (const size of sizesIn(r.body)) {
        expect(size, `${r.selector} { ${r.body.split(';')[0]} }`).toBeGreaterThanOrEqual(1);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('uses white text, not grey: no HUD rule colours text with the muted grey', () => {
    for (const r of hudRules()) expect(r.body, r.selector).not.toMatch(/color:\s*var\(--muted\)/);
    expect(hudRules().some((r) => /(^|;|\s)color:\s*#fff/.test(r.body))).toBe(true);
  });

  it('draws the panels as dark glass: a dark, see-through background with a light edge', () => {
    const glass = /--glass:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(root)!;
    expect(glass).not.toBeNull();
    const [r, g, b, a] = [Number(glass[1]), Number(glass[2]), Number(glass[3]), Number(glass[4])];
    expect(r + g + b).toBeLessThan(120); // dark
    expect(a).toBeGreaterThanOrEqual(0.5);
    expect(a).toBeLessThanOrEqual(0.9); // see-through
    for (const sel of ['.hud2-speed', '.hud2-progress', '.hud2-caption', '.popup', '.card']) {
      const rule = rules(screens).find((x) => x.selector.split(',').map((s) => s.trim()).includes(sel) && x.body.includes('var(--glass)'));
      expect(rule, sel).toBeDefined();
    }
  });

  it('has one cyan accent and amber for warnings', () => {
    expect(root).toMatch(/--cyan:\s*#63c7e6/);
    expect(root).toMatch(/--amber:\s*#ffb02e/);
    const bar = rules(screens).find((x) => x.selector === '.bar > span')!;
    expect(bar.body).toContain('var(--cyan)');
    const slip = rules(screens).find((x) => x.selector === '.badge.slip')!;
    expect(slip.body).toContain('var(--amber)');
    const warn = rules(screens).find((x) => x.selector === '.popup-warn')!;
    expect(warn.body).toContain('var(--amber)');
    const info = rules(screens).find((x) => x.selector === '.popup')!;
    expect(info.body).toContain('var(--cyan)');
  });
});

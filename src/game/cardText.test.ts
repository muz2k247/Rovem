import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { cardForPopup } from './cardText.ts';
import { levelText } from './level/text.ts';
import type { Popup, PopupElement } from './popups.ts';

const popup = (element: PopupElement): Popup => ({ element, text: 'x', tone: 'info' });
const card = (element: PopupElement, kind = '') => cardForPopup(popup(element), kind, { runText: content.runText, levelCards: levelText.elementCards });

describe('caption cards', () => {
  it('every element has a card except a crash (the report explains that)', () => {
    const all: PopupElement[] = ['sand', 'mud', 'ice', 'bend', 'vent', 'launcher', 'cave', 'slope', 'water', 'magnet', 'scrape', 'slip', 'topSpeed'];
    for (const e of all) {
      const c = card(e, e === 'launcher' ? 'headOnHit' : '');
      expect(c, e).toBeDefined();
      expect(c!.title, e).not.toBe('');
      expect(c!.line, e).not.toBe('');
      expect(c!.element).toBe(e);
    }
    expect(card('crash', 'crash')).toBeUndefined();
  });

  it('takes the name and the sentence from the Endless text where it has them: a vent is a "Vent", not a "Boost pad"', () => {
    expect(card('vent')).toEqual({ element: 'vent', title: 'Vent', line: content.runText.tidbits.boost });
    expect(card('bend')!.title).toBe('Tight turn');
    expect(card('cave')!.line).toBe(content.runText.tidbits.gravity);
  });

  it('a launcher card says what a bag from the front does and what one from behind does', () => {
    expect(card('launcher', 'headOnHit')!.line).toBe(content.runText.tidbits.headOnHit);
    expect(card('launcher', 'kickerHit')!.line).toBe(content.runText.tidbits.kickerHit);
    expect(card('launcher', 'headOnHit')!.line).not.toBe(card('launcher', 'kickerHit')!.line);
  });

  it('slope, water and magnet come from the level text', () => {
    expect(card('slope')!.title).toBe(levelText.elementCards.slope!.title);
    expect(card('water')!.line).toBe(levelText.elementCards.water!.line);
    expect(card('magnet')!.title).toBe(levelText.elementCards.magnet!.title);
  });
});

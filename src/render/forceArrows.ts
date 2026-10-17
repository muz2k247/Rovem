import { ArrowHelper, CanvasTexture, Group, Object3D, Sprite, SpriteMaterial, Vector3 } from 'three';
import { levelsConfig, type ForceKind, type LevelsConfig } from '../content/levelsConfig.ts';
import type { ForceArrow } from '../game/contracts.ts';

// Force arrows drawn on the rover (LEVELS_BUILD_PLAN A4). The game layer says which forces to show; this
// file only turns a list of ForceArrow into three.js objects. It never decides what the physics did.

type ArrowStyle = LevelsConfig['arrows'];

const NAMES: Record<ForceKind, string> = {
  push: 'Push',
  brake: 'Brake',
  friction: 'Friction',
  drag: 'Water drag',
  weight: 'Weight',
  slope: 'Slope pull',
  upthrust: 'Upthrust',
  turning: 'Turning force needed',
  magnet: 'Magnet',
  impulse: 'Impulse',
};

export const arrowName = (kind: ForceKind): string => NAMES[kind];

/** Length in metres: base + perForce × F ÷ reference, at most the maximum (A4: 0.5 m + 2.5 m × F ÷ 2000 N, ≤ 3 m). */
export function arrowLengthM(forceN: number, style: ArrowStyle = levelsConfig.arrows): number {
  return Math.min(style.maxLengthM, style.baseLengthM + (style.perForceM * forceN) / style.referenceForceN);
}

/** Forces under the hide limit (20 N) are not drawn. */
export function isArrowVisible(forceN: number, style: ArrowStyle = levelsConfig.arrows): boolean {
  return forceN >= style.hideBelowN;
}

/** The name, whole newtons, and the optional extra text: `Push 1000 N` or `Turning force needed 1551 N · tyres give up to 1638 N`. */
export function arrowLabel(arrow: ForceArrow): string {
  const base = `${arrowName(arrow.kind)} ${Math.round(arrow.forceN)} N`;
  return arrow.extraLabel ? `${base} · ${arrow.extraLabel}` : base;
}

/** Makes the label object for one arrow, or null for none. Replaceable so tests run without a canvas. */
export type LabelFactory = (text: string, colour: string) => Object3D | null;

/** A text sprite drawn on a canvas. Returns null where there is no canvas (Node tests). */
export const canvasLabel: LabelFactory = (text, colour) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const font = '600 28px "IBM Plex Sans", system-ui, sans-serif';
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + 20;
  canvas.height = 44;
  ctx.font = font;
  ctx.fillStyle = 'rgba(13, 17, 23, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colour;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 10, canvas.height / 2);
  const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(canvas), depthTest: false, transparent: true }));
  const heightM = 0.3;
  sprite.scale.set((heightM * canvas.width) / canvas.height, heightM, 1);
  return sprite;
};

interface Slot {
  arrow: ArrowHelper;
  label: Object3D | null;
  labelText: string;
}

export interface ForceArrows {
  /** Add this to the rover's group; arrows start at its origin. */
  group: Group;
  /** Show exactly these forces (those under the hide limit or with no direction are skipped). */
  update(arrows: readonly ForceArrow[]): void;
  dispose(): void;
}

export function createForceArrows(style: ArrowStyle = levelsConfig.arrows, makeLabel: LabelFactory = canvasLabel): ForceArrows {
  const group = new Group();
  const slots: Slot[] = [];
  const dir = new Vector3();
  const tip = new Vector3();

  const disposeLabel = (label: Object3D | null) => {
    if (!label) return;
    group.remove(label);
    if (label instanceof Sprite) {
      label.material.map?.dispose();
      label.material.dispose();
    }
  };

  const slot = (i: number): Slot => {
    let s = slots[i];
    if (!s) {
      const arrow = new ArrowHelper(new Vector3(1, 0, 0), new Vector3(), 1, 0xffffff);
      arrow.visible = false;
      group.add(arrow);
      s = { arrow, label: null, labelText: '' };
      slots[i] = s;
    }
    return s;
  };

  const hide = (s: Slot) => {
    s.arrow.visible = false;
    if (s.label) s.label.visible = false;
  };

  return {
    group,
    update(arrows) {
      let used = 0;
      for (const a of arrows) {
        if (!isArrowVisible(a.forceN, style)) continue;
        dir.set(a.directionWorld.x, a.directionWorld.y, a.directionWorld.z);
        if (dir.lengthSq() === 0) continue;
        dir.normalize();
        const s = slot(used++);
        const length = arrowLengthM(a.forceN, style);
        const colour = style.colours[a.kind];
        s.arrow.setDirection(dir);
        s.arrow.setLength(length, Math.min(0.35, length * 0.4), 0.15);
        s.arrow.setColor(colour);
        s.arrow.userData.lengthM = length;
        s.arrow.userData.colour = colour;
        s.arrow.visible = true;

        const text = arrowLabel(a);
        if (text !== s.labelText) {
          disposeLabel(s.label);
          s.label = makeLabel(text, colour);
          if (s.label) group.add(s.label);
          s.labelText = text;
        }
        if (s.label) {
          tip.copy(dir).multiplyScalar(length);
          s.label.position.set(tip.x, tip.y + 0.25, tip.z);
          s.label.visible = true;
        }
      }
      for (let i = used; i < slots.length; i++) hide(slots[i]!);
    },
    dispose() {
      for (const s of slots) {
        disposeLabel(s.label);
        s.arrow.dispose();
      }
      slots.length = 0;
      group.clear();
    },
  };
}

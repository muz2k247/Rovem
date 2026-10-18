import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import {
  chassisStyleFor,
  createRoverModel,
  motorStyleFor,
  roverLookFor,
  wheelStyleFor,
  type ChassisStyle,
  type MotorStyle,
  type RoverLook,
  type WheelStyle,
} from './roverModel.ts';

const L = content.constants.roverLengthM;
const W = content.constants.roverWidthM;

const CHASSIS: ChassisStyle[] = ['light', 'standard', 'heavy'];
const MOTORS: MotorStyle[] = ['small', 'medium', 'large'];
const WHEELS: WheelStyle[] = ['smooth', 'all-terrain', 'spiked'];

const look = (chassis: ChassisStyle, wheels: WheelStyle, motor: MotorStyle): RoverLook => ({ chassis, wheels, motor });
const named = (root: THREE.Object3D, name: string) => {
  const found: THREE.Object3D[] = [];
  root.traverse((o) => o.name === name && found.push(o));
  return found;
};
const size = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const meshCount = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => c instanceof THREE.Mesh && n++);
  return n;
};

describe('part ids → looks', () => {
  it('maps the nine parts to their own looks', () => {
    expect(['chassis-light', 'chassis-standard', 'chassis-heavy'].map(chassisStyleFor)).toEqual(CHASSIS);
    expect(['motor-small', 'motor-medium', 'motor-large'].map(motorStyleFor)).toEqual(MOTORS);
    expect(['wheels-smooth', 'wheels-all-terrain', 'wheels-spiked'].map(wheelStyleFor)).toEqual(WHEELS);
  });
  it('unknown ids fall back to the starting parts', () => {
    expect([chassisStyleFor('?'), wheelStyleFor('?'), motorStyleFor('?')]).toEqual(['standard', 'all-terrain', 'medium']);
  });
  it('a whole build gives a whole look', () => {
    expect(roverLookFor({ chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked', motorId: 'motor-large' })).toEqual(
      look('heavy', 'spiked', 'large'),
    );
  });
});

describe('the footprint does not change (1.7 m wide, 2 m long)', () => {
  it.each(CHASSIS.flatMap((c) => WHEELS.flatMap((w) => MOTORS.map((m) => [c, w, m] as const))))(
    '%s / %s / %s is 1.7 m wide and inside the 2 m length',
    (c, w, m) => {
      const root = createRoverModel(L, W, look(c, w, m)).root;
      const box = new THREE.Box3().setFromObject(root);
      expect(box.max.z - box.min.z).toBeCloseTo(W, 6);
      expect(box.max.x).toBeLessThanOrEqual(1e-6); // the origin is the rover's front
      expect(box.min.x).toBeGreaterThanOrEqual(-L - 1e-6);
    },
  );
  it('the wheels still sit on the ground', () => {
    const box = new THREE.Box3().setFromObject(createRoverModel(L, W, look('standard', 'all-terrain', 'medium')).root);
    expect(Math.abs(box.min.y)).toBeLessThan(0.03); // the tread blocks stand a hair below the tyre
  });
});

describe('the three bodies look different', () => {
  const model = (c: ChassisStyle) => createRoverModel(L, W, look(c, 'all-terrain', 'medium'));
  const part = (c: ChassisStyle) => model(c).parts.chassis;

  it('Light is an open frame of tubes and struts, with no body plates or rivets', () => {
    const p = part('light');
    expect(named(p, 'tube').length).toBeGreaterThanOrEqual(8);
    expect(named(p, 'strut').length).toBeGreaterThanOrEqual(4);
    expect(named(p, 'shell')).toHaveLength(0);
    expect(named(p, 'rivet')).toHaveLength(0);
  });
  it('Standard is a plated body: a shell with side plates, and no tubes or rivets', () => {
    const p = part('standard');
    expect(named(p, 'shell')).toHaveLength(1);
    expect(named(p, 'plate').length).toBeGreaterThanOrEqual(2);
    expect(named(p, 'tube')).toHaveLength(0);
    expect(named(p, 'rivet')).toHaveLength(0);
  });
  it('Heavy is armoured: a shell, big side plates, rivets and a bumper', () => {
    const p = part('heavy');
    expect(named(p, 'shell')).toHaveLength(1);
    expect(named(p, 'plate').length).toBeGreaterThanOrEqual(4);
    expect(named(p, 'rivet').length).toBeGreaterThanOrEqual(8);
    expect(named(p, 'bumper')).toHaveLength(1);
    expect(named(part('standard'), 'bumper')).toHaveLength(0);
  });
  it('the three use different colours (a body material each)', () => {
    const colour = (c: ChassisStyle) => {
      const mesh = named(part(c), c === 'light' ? 'tube' : 'shell')[0] as THREE.Mesh;
      return (mesh.material as THREE.MeshStandardMaterial).color.getHex();
    };
    expect(new Set(CHASSIS.map(colour)).size).toBe(3);
  });
});

describe('the three motors differ clearly in size and fins', () => {
  const pod = (m: MotorStyle) => createRoverModel(L, W, look('standard', 'all-terrain', m)).parts.motor;
  it('housing volume grows Small < Medium < Large', () => {
    const volume = (m: MotorStyle) => {
      const s = size(named(pod(m), 'housing')[0]!);
      return s.x * s.y * s.z;
    };
    expect(volume('small')).toBeLessThan(volume('medium'));
    expect(volume('medium')).toBeLessThan(volume('large'));
    expect(volume('large') / volume('small')).toBeGreaterThan(1.8);
  });
  it('cooling fins: 3, 4 and 6', () => {
    expect(MOTORS.map((m) => named(pod(m), 'fin').length)).toEqual([3, 4, 6]);
  });
});

describe('shared details on every rover', () => {
  const model = createRoverModel(L, W, look('standard', 'all-terrain', 'medium'));
  it('has a solar panel, a mast with a two-lens camera, an antenna dish, two rocker arms, a headlight', () => {
    for (const name of ['solarPanel', 'mast', 'dish', 'headlight']) expect(named(model.root, name)).toHaveLength(1);
    expect(named(model.root, 'lens')).toHaveLength(2);
    expect(named(model.root, 'rocker')).toHaveLength(2);
  });
  it('is the same for all nine part looks', () => {
    for (const c of CHASSIS) {
      for (const m of MOTORS) {
        const root = createRoverModel(L, W, look(c, 'smooth', m)).root;
        expect(named(root, 'mast')).toHaveLength(1);
        expect(named(root, 'rocker')).toHaveLength(2);
      }
    }
  });
});

describe('every one of the nine parts changes the model', () => {
  const base = look('standard', 'all-terrain', 'medium');
  const signature = (l: RoverLook) => {
    const m = createRoverModel(L, W, l);
    return JSON.stringify({ meshes: meshCount(m.root), box: size(m.root).toArray().map((n) => n.toFixed(4)), colours: colours(m.root) });
  };
  const colours = (root: THREE.Object3D) => {
    const set = new Set<number>();
    root.traverse((o) => o instanceof THREE.Mesh && set.add((o.material as THREE.MeshStandardMaterial).color.getHex()));
    return [...set].sort();
  };
  it('swapping any one part gives a different model', () => {
    const seen = new Set([signature(base)]);
    for (const c of CHASSIS) seen.add(signature({ ...base, chassis: c }));
    for (const w of WHEELS) seen.add(signature({ ...base, wheels: w }));
    for (const m of MOTORS) seen.add(signature({ ...base, motor: m }));
    expect(seen.size).toBe(7); // the base, and two others in each of the three slots
  });
});

describe('steering, spinning and attitude', () => {
  const model = createRoverModel(L, W, look('standard', 'all-terrain', 'medium'));

  it('has four wheels that spin; the first two (front) are mounted on steering pivots', () => {
    expect(model.wheels).toHaveLength(4);
    expect(model.steerPivots).toHaveLength(2);
    for (const p of model.steerPivots) expect(p.children).toContain(model.wheels[model.steerPivots.indexOf(p)]);
  });
  it('setSteer turns only the front wheels, about the vertical axis', () => {
    model.setSteer(0.4);
    for (const p of model.steerPivots) expect(p.rotation.y).toBeCloseTo(0.4, 12);
    for (const w of model.wheels) expect(w.rotation.y).toBe(0);
    model.setSteer(0);
    for (const p of model.steerPivots) expect(p.rotation.y).toBe(0);
  });
  it('setAttitude pitches nose-up for a positive pitch and leans the top outward for a positive lean', () => {
    const noseY = () => {
      model.root.updateMatrixWorld(true);
      return new THREE.Vector3(0.9, 0.6, 0).applyMatrix4(model.parts.chassis.matrixWorld).y; // a point on the nose
    };
    const before = noseY();
    model.setAttitude({ pitchRad: 0.1, leanRad: 0 });
    expect(noseY()).toBeGreaterThan(before);
    model.setAttitude({ pitchRad: 0, leanRad: 0.05 });
    model.root.updateMatrixWorld(true);
    const top = new THREE.Vector3(0, 1.2, 0).applyMatrix4(model.parts.chassis.matrixWorld);
    expect(top.z).toBeGreaterThan(0);
    model.setAttitude({ pitchRad: 0, leanRad: 0 });
    expect(noseY()).toBeCloseTo(before, 12);
  });
  it('the attitude never moves the outer body group, which the drive scene still lifts and tilts', () => {
    model.setAttitude({ pitchRad: 0.1, leanRad: 0.05 });
    expect(model.body.rotation.z).toBe(0);
    expect(model.body.position.y).toBe(0);
    model.setAttitude({ pitchRad: 0, leanRad: 0 });
  });
});

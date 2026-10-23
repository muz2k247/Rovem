import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import {
  chassisStyleFor,
  createRoverModel,
  motorStyleFor,
  roverLookFor,
  STARTING_LOOK,
  wheelStyleFor,
  wheelTurnRad,
  MAX_WHEEL_TURN_PER_FRAME_RAD,
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

// The parts are unnamed meshes now (roverParts.ts), so these tests find them by what they are made of.
const COLOUR = { solar: 0x15254d, dish: 0xd49b42, headlight: 0xfff6cf };
const meshes = (root: THREE.Object3D) => {
  const found: THREE.Mesh[] = [];
  root.traverse((o) => o instanceof THREE.Mesh && found.push(o));
  return found;
};
const withColour = (root: THREE.Object3D, hex: number) => meshes(root).filter((m) => (m.material as THREE.MeshStandardMaterial).color.getHex() === hex);
const tubes = (root: THREE.Object3D) => meshes(root).filter((m) => m.geometry instanceof THREE.CylinderGeometry && m.geometry.parameters.radiusTop <= 0.02);

describe('the footprint does not change (1.7 m wide, 2 m long)', () => {
  it.each(CHASSIS.flatMap((c) => WHEELS.flatMap((w) => MOTORS.map((m) => [c, w, m] as const))))(
    '%s / %s / %s is 1.7 m wide and inside the 2 m length',
    (c, w, m) => {
      const root = createRoverModel(L, W, look(c, w, m)).root;
      const box = new THREE.Box3().setFromObject(root);
      // The wheel faces sit at ±0.85 m; a hub nut or spindle stands up to 3 cm proud of them (roverParts.ts), so the width is 1.7 m plus that.
      expect(box.max.z - box.min.z).toBeGreaterThanOrEqual(W - 1e-6);
      expect(box.max.z - box.min.z).toBeLessThanOrEqual(W + 0.07);
      expect(box.max.x).toBeLessThanOrEqual(1e-6); // the origin is the rover's front
      expect(box.min.x).toBeGreaterThanOrEqual(-L - 1e-6);
    },
  );
  it('the wheels still sit on the ground', () => {
    const box = new THREE.Box3().setFromObject(createRoverModel(L, W, look('standard', 'all-terrain', 'medium')).root);
    expect(Math.abs(box.min.y)).toBeLessThan(0.03); // the tread blocks stand a hair below the tyre
  });
  it('the wheel mounts are at (±0.54, 0.42, ±(0.85 − width/2))', () => {
    for (const [wheel, width] of [['smooth', 0.26], ['all-terrain', 0.3], ['spiked', 0.32]] as const) {
      const m = createRoverModel(L, W, look('standard', wheel, 'medium'));
      for (const mount of m.parts.wheelMounts) {
        expect(Math.abs(mount.position.z)).toBeCloseTo(0.85 - width / 2, 9);
        expect(Math.abs(mount.position.x)).toBeCloseTo(0.54, 9);
        expect(mount.position.y).toBeCloseTo(0.42, 9);
      }
    }
  });
});

describe('the three bodies look different', () => {
  const part = (c: ChassisStyle) => createRoverModel(L, W, look(c, 'all-terrain', 'medium')).parts.chassis;

  it('Light is an open frame of thin tubes (a spaceframe), Standard and Heavy are solid hulls', () => {
    expect(tubes(part('light')).length).toBeGreaterThanOrEqual(16);
    expect(tubes(part('standard')).length).toBeLessThan(tubes(part('light')).length / 2);
    expect(tubes(part('heavy')).length).toBeLessThan(tubes(part('light')).length / 2);
  });
  it('Heavy has four floodlights; the others have two lights', () => {
    expect(withColour(part('light'), COLOUR.headlight)).toHaveLength(2);
    expect(withColour(part('standard'), COLOUR.headlight)).toHaveLength(2);
    expect(withColour(part('heavy'), COLOUR.headlight)).toHaveLength(4);
  });
  it('the biggest box in the body grows Light < Standard < Heavy', () => {
    const biggest = (c: ChassisStyle) =>
      Math.max(
        ...meshes(part(c))
          .filter((m) => m.geometry instanceof THREE.BoxGeometry)
          .map((m) => {
            const s = size(m);
            return s.x * s.y * s.z;
          }),
      );
    expect(biggest('light')).toBeLessThan(biggest('standard'));
    expect(biggest('standard')).toBeLessThan(biggest('heavy'));
  });
});

describe('the three motors differ clearly in size and parts', () => {
  const pod = (m: MotorStyle) => createRoverModel(L, W, look('standard', 'all-terrain', m)).parts.motor;
  it('the motor block grows Small < Medium < Large', () => {
    const volume = (m: MotorStyle) => {
      const s = size(pod(m));
      return s.x * s.y * s.z;
    };
    expect(volume('small')).toBeLessThan(volume('medium'));
    expect(volume('medium')).toBeLessThan(volume('large'));
    expect(volume('large') / volume('small')).toBeGreaterThan(1.8);
  });
  it('the cooling parts grow: more meshes in Medium than Small, and in Large than Medium', () => {
    const [s, m, l] = MOTORS.map((x) => meshCount(pod(x)));
    expect(s).toBeLessThan(m!);
    expect(m).toBeLessThan(l!);
  });
});

describe('shared details on every rover', () => {
  it('has solar cells, a camera with two lenses, a brass dish, two rocker pivots and a headlight, whatever the chassis', () => {
    for (const c of CHASSIS) {
      const chassis = createRoverModel(L, W, look(c, 'smooth', 'small')).parts.chassis;
      expect(withColour(chassis, COLOUR.solar).length).toBeGreaterThanOrEqual(1);
      expect(withColour(chassis, COLOUR.dish).length).toBeGreaterThanOrEqual(1);
      expect(withColour(chassis, COLOUR.headlight).length).toBeGreaterThanOrEqual(2);
      const lenses = meshes(chassis).filter((m) => (m.material as THREE.MeshStandardMaterial).color.getHex() === 0x1b1c20 && m.position.y > 0.95 && m.geometry instanceof THREE.CylinderGeometry);
      expect(lenses).toHaveLength(2);
      // a rocker arm pivot on each side, 0.52 m out and 0.66 m up
      const pivots = meshes(chassis).filter((m) => Math.abs(m.position.y - 0.66) < 1e-6 && Math.abs(m.position.x) < 1e-6 && Math.abs(Math.abs(m.position.z) - 0.52) < 0.01);
      expect(pivots.some((m) => m.position.z > 0)).toBe(true);
      expect(pivots.some((m) => m.position.z < 0)).toBe(true);
    }
  });
  it('the chassis carries its own deck: the model adds no loose deck group', () => {
    const root = createRoverModel(L, W, look('standard', 'all-terrain', 'medium')).root;
    expect(named(root, 'deck')).toHaveLength(0);
    expect(named(root, 'chassis')).toHaveLength(1);
    expect(named(root, 'motor')).toHaveLength(1);
  });
  it('has fewer than 6000 triangles for any of the 27 builds', () => {
    const tris = (o: THREE.Object3D) => meshes(o).reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3, 0);
    for (const c of CHASSIS) for (const w of WHEELS) for (const m of MOTORS) expect(tris(createRoverModel(L, W, look(c, w, m)).root)).toBeLessThan(6000);
  });
  it('every rover makes its own materials, so re-colouring one never changes another', () => {
    const a = new Set(meshes(createRoverModel(L, W, STARTING_LOOK).root).map((m) => m.material));
    const b = new Set(meshes(createRoverModel(L, W, STARTING_LOOK).root).map((m) => m.material));
    expect([...a].filter((x) => b.has(x))).toHaveLength(0);
  });
  it('the left wheels are turned half a turn so the outer face stays outward; the spin groups are not', () => {
    const m = createRoverModel(L, W, look('standard', 'smooth', 'medium'));
    m.parts.wheelMounts.forEach((mount, i) => {
      const spin = m.wheels[i]!;
      expect(mount.children).toContain(spin);
      expect(spin.rotation.y).toBe(0);
      expect(spin.children[0]!.rotation.y).toBeCloseTo(mount.position.z < 0 ? Math.PI : 0, 12);
    });
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

describe('wheelTurnRad', () => {
  it('is distance ÷ wheel radius when slow, and is capped per frame so fast wheels never look still', () => {
    expect(wheelTurnRad(0.042)).toBeCloseTo(0.1, 10);
    expect(wheelTurnRad(0.27)).toBe(MAX_WHEEL_TURN_PER_FRAME_RAD);
    expect(wheelTurnRad(-0.27)).toBe(-MAX_WHEEL_TURN_PER_FRAME_RAD);
    expect(wheelTurnRad(0)).toBe(0);
  });
});

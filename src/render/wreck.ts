import * as THREE from 'three';
import { createShipModel } from './shipModel.ts';

// The smoking wreck beside Crash Site's start (SHOWCASE_PLAN §3 Level 1, §12): the ship model on its side without its five parts,
// a scorch mark, a few pieces of debris and a column of smoke. Original low-poly shapes from three.js geometry; no outside
// asset. Presentation only: the numbers here are looks.

const PUFFS = 9;
/** The lying ship: scaled down a little, turned about its middle (a height on the standing model). */
const SHIP_LYING_SCALE = 0.8;
const SHIP_LYING_PIVOT_M = 6.5;
const SMOKE_RISE_M = 9;
const SMOKE_PERIOD_S = 7;

export interface Wreck {
  group: THREE.Group;
  /** Where a label over the wreck stands (three.js coordinates). */
  anchor: THREE.Vector3;
  update(timeS: number): void;
  dispose(): void;
}

/** The wreck at a spot of the level (physics x, z in metres, a heading in degrees), standing on ground `groundYM` high. */
export function createWreck(at: { xM: number; zM: number; headingDeg: number }, groundYM: number): Wreck {
  const group = new THREE.Group();
  group.name = 'wreck';
  group.position.set(at.xM, groundYM, -at.zM);
  group.rotation.y = (at.headingDeg * Math.PI) / 180;
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => {
    owned.push(d);
    return d;
  };
  const metal = own(new THREE.MeshStandardMaterial({ color: 0x8a95a8, flatShading: true, metalness: 0.4, roughness: 0.6 }));
  const burnt = own(new THREE.MeshStandardMaterial({ color: 0x2a2624, flatShading: true, roughness: 0.9 }));
  const warm = own(new THREE.MeshStandardMaterial({ color: 0xe8743b, flatShading: true, emissive: 0x7a2a08, emissiveIntensity: 0.8 }));

  const scorch = new THREE.Mesh(own(new THREE.CircleGeometry(7.5, 20)), own(new THREE.MeshBasicMaterial({ color: 0x1c1816, transparent: true, opacity: 0.55, depthWrite: false })));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.06;
  group.add(scorch);

  // The ship itself (R15): the designed model lying on its side, nose a little up, with all five parts gone (they are scattered
  // over the level; each level's crate brings one home).
  const ship = createShipModel({ brakes: 'missing', thruster: 'missing', liftEngine: 'missing', floats: 'missing', clamps: 'missing' });
  owned.push(ship);
  ship.group.position.y = -SHIP_LYING_PIVOT_M;
  const lying = new THREE.Group();
  lying.scale.setScalar(SHIP_LYING_SCALE);
  lying.rotation.z = -(Math.PI / 2 - 0.22);
  lying.position.set(0.3, 1.5, 0);
  lying.add(ship.group);
  group.add(lying);
  const glow = new THREE.Mesh(own(new THREE.SphereGeometry(0.7, 6, 5)), warm);
  glow.position.set(-4.3, 1, 0.3);
  group.add(glow);

  // Debris on the ground.
  const pieces: [number, number, number, number][] = [[-6.5, 0.2, 3, 0.6], [2, 0.25, 4.6, 1.1], [7, 0.15, -3, 0.5], [-3, 0.2, -4.5, 0.9], [5, 0.2, 3.5, 0.4]];
  const pieceGeometry = own(new THREE.BoxGeometry(1, 0.4, 0.7));
  for (const [x, y, z, size] of pieces) {
    const p = new THREE.Mesh(pieceGeometry, size > 0.8 ? metal : burnt);
    p.position.set(x, y, z);
    p.scale.setScalar(size);
    p.rotation.y = x * 0.9;
    group.add(p);
  }

  // The smoke: grey puffs that rise from the torn end, grow and fade, each a third of a period behind the last.
  const puffGeometry = own(new THREE.IcosahedronGeometry(1, 0));
  const puffs = Array.from({ length: PUFFS }, (_, i) => {
    const material = own(new THREE.MeshBasicMaterial({ color: 0x4b4744, transparent: true, opacity: 0, depthWrite: false }));
    const mesh = new THREE.Mesh(puffGeometry, material);
    group.add(mesh);
    return { mesh, material, phase: i / PUFFS, drift: (i % 3) - 1 };
  });

  const anchor = new THREE.Vector3(at.xM, groundYM + 5.5, -at.zM);

  return {
    group,
    anchor,
    update(timeS: number) {
      for (const p of puffs) {
        const t = (((timeS / SMOKE_PERIOD_S + p.phase) % 1) + 1) % 1;
        p.mesh.position.set(-4.3 + p.drift * 0.6 * t * 3, 1.6 + t * SMOKE_RISE_M, 0.3 + Math.sin(t * 5 + p.phase * 6) * 0.8);
        p.mesh.scale.setScalar(0.5 + t * 2.2);
        p.material.opacity = 0.5 * Math.sin(Math.PI * t) ** 1.5;
      }
    },
    dispose() {
      for (const d of owned) d.dispose();
    },
  };
}

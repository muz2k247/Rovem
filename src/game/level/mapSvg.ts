import type { PointM } from '../../content/index.ts';
import type { LevelDef } from './types.ts';
import type { LevelWorld } from './world.ts';

// A top-down picture of a level (SHOWCASE_PLAN §13, `npm run maps`): roads and their run-off, surfaces, water, gravity zones, hills,
// craters, ridges, and every marker the level file places. A tool for the people who build levels: it reads the level file and the
// world and draws what is there, nothing else. Physics x runs right, z runs up the picture. Pure: it returns the SVG text.

const DEG = Math.PI / 180;
const MARGIN_M = 30;
const WIDTH_PX = 1400;

const SURFACE_COLOURS: Record<string, string> = { asphalt: '#5d6270', sand: '#d8b878', ice: '#b6dcf0', mud: '#6a4a2e' };
const ROAD_FALLBACK = '#8a8f9c';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();

/** Everything the picture needs, in one place so a test can see what was drawn. */
export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** The box round every road of the level, with a margin. */
export function mapBounds(world: LevelWorld): MapBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const road of world.roads) {
    const reach = road.widthM / 2 + road.runoffM;
    for (const p of road.line.points) {
      minX = Math.min(minX, p.xM - reach);
      maxX = Math.max(maxX, p.xM + reach);
      minZ = Math.min(minZ, p.zM - reach);
      maxZ = Math.max(maxZ, p.zM + reach);
    }
  }
  return { minX: minX - MARGIN_M, maxX: maxX + MARGIN_M, minZ: minZ - MARGIN_M, maxZ: maxZ + MARGIN_M };
}

export function levelMapSvg(def: LevelDef, world: LevelWorld): string {
  const b = mapBounds(world);
  const widthM = b.maxX - b.minX;
  const heightM = b.maxZ - b.minZ;
  const scale = WIDTH_PX / widthM; // pixels per metre
  const heightPx = Math.round(heightM * scale);
  const X = (x: number) => n1((x - b.minX) * scale);
  const Y = (z: number) => n1((b.maxZ - z) * scale);
  const R = (m: number) => n1(m * scale);
  const out: string[] = [];
  const push = (s: string) => out.push(s);
  const label = (x: number, z: number, text: string, extra = '') =>
    push(`<text x="${X(x)}" y="${Y(z)}" font-size="13" font-family="sans-serif" ${extra.includes('fill=') ? '' : 'fill="#10131a"'} stroke="#fff" stroke-width="3" paint-order="stroke" ${extra}>${esc(text)}</text>`);
  const polygon = (points: readonly PointM[], attrs: string) =>
    push(`<polygon points="${points.map((p) => `${X(p.xM)},${Y(p.zM)}`).join(' ')}" ${attrs}/>`);
  const polyline = (points: readonly PointM[], attrs: string) =>
    push(`<polyline points="${points.map((p) => `${X(p.xM)},${Y(p.zM)}`).join(' ')}" fill="none" stroke-linejoin="round" stroke-linecap="round" ${attrs}/>`);

  push(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH_PX}" height="${heightPx}" viewBox="0 0 ${WIDTH_PX} ${heightPx}">`);
  push(`<title>${esc(def.name)}: top-down map</title>`);
  push(`<rect width="100%" height="100%" fill="#ece3d2"/>`);

  // A 100 m grid, labelled along the bottom and left.
  const gx0 = Math.ceil(b.minX / 100) * 100;
  for (let x = gx0; x <= b.maxX; x += 100) {
    push(`<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${heightPx}" stroke="#c9bfa9" stroke-width="1"/>`);
    push(`<text x="${X(x) }" y="${heightPx - 6}" font-size="11" font-family="sans-serif" fill="#7a705c">x ${x}</text>`);
  }
  const gz0 = Math.ceil(b.minZ / 100) * 100;
  for (let z = gz0; z <= b.maxZ; z += 100) {
    push(`<line x1="0" y1="${Y(z)}" x2="${WIDTH_PX}" y2="${Y(z)}" stroke="#c9bfa9" stroke-width="1"/>`);
    push(`<text x="4" y="${n1(Number(Y(z)) - 3)}" font-size="11" font-family="sans-serif" fill="#7a705c">z ${z}</text>`);
  }

  // Ground height: hills, craters and ridges, drawn first so the roads show on top.
  for (const h of def.hills) {
    push(`<circle cx="${X(h.xM)}" cy="${Y(h.zM)}" r="${R(h.radiusM)}" fill="#c9a572" fill-opacity="0.35" stroke="#9c7a48" stroke-dasharray="6 4"/>`);
    label(h.xM, h.zM, `hill ${h.heightM} m`, 'text-anchor="middle"');
  }
  for (const c of def.craters) {
    const rampRun = c.depthM / Math.tan(c.rampAngleDeg * DEG);
    const wallRun = c.depthM / Math.tan(c.wallAngleDeg * DEG);
    push(`<circle cx="${X(c.xM)}" cy="${Y(c.zM)}" r="${R(c.floorRadiusM + rampRun)}" fill="#7a5a3a" fill-opacity="0.12" stroke="#7a5a3a" stroke-dasharray="3 5"/>`);
    push(`<circle cx="${X(c.xM)}" cy="${Y(c.zM)}" r="${R(c.floorRadiusM + wallRun)}" fill="#7a5a3a" fill-opacity="0.18" stroke="#7a5a3a"/>`);
    push(`<circle cx="${X(c.xM)}" cy="${Y(c.zM)}" r="${R(c.floorRadiusM)}" fill="#4d3822" fill-opacity="0.35"/>`);
    const rx = c.xM + Math.cos(c.rampHeadingDeg * DEG) * (c.floorRadiusM + rampRun);
    const rz = c.zM + Math.sin(c.rampHeadingDeg * DEG) * (c.floorRadiusM + rampRun);
    push(`<line x1="${X(c.xM)}" y1="${Y(c.zM)}" x2="${X(rx)}" y2="${Y(rz)}" stroke="#2f7d3b" stroke-width="2"/>`);
    label(c.xM, c.zM, `crater ${c.depthM} m deep, wall ${c.wallAngleDeg}°, ramp ${c.rampAngleDeg}°`, 'text-anchor="middle"');
  }
  for (const r of def.ridges) {
    const topM = r.riseLengthM * Math.tan(r.riseAngleDeg * DEG);
    const lengthM = r.riseLengthM + r.topLengthM + topM / Math.tan(r.fallAngleDeg * DEG);
    const h = r.headingDeg * DEG;
    const corner = (u: number, v: number): PointM => ({
      xM: r.xM + Math.cos(h) * u - Math.sin(h) * v,
      zM: r.zM + Math.sin(h) * u + Math.cos(h) * v,
    });
    polygon([corner(0, -r.widthM / 2), corner(lengthM, -r.widthM / 2), corner(lengthM, r.widthM / 2), corner(0, r.widthM / 2)], 'fill="#8c6a44" fill-opacity="0.3" stroke="#6b4a2a"');
    label(r.xM, r.zM, `ridge ${r.riseAngleDeg}° up, ${r.fallAngleDeg}° down`);
  }

  // Surface patches, water and gravity zones.
  for (const z of def.surfaceZones) polygon(z.polygon, `fill="${SURFACE_COLOURS[z.surfaceId] ?? ROAD_FALLBACK}" fill-opacity="0.85" stroke="#2a2a2a" stroke-width="1"`);
  for (const w of def.water) {
    polygon(w.polygon, 'fill="#3f8fd8" fill-opacity="0.6" stroke="#1d5fa3"');
    const mid = w.polygon.reduce((a, p) => ({ xM: a.xM + p.xM / w.polygon.length, zM: a.zM + p.zM / w.polygon.length }), { xM: 0, zM: 0 });
    label(mid.xM, mid.zM, `water ${w.depthM} m`, 'text-anchor="middle"');
  }
  for (const g of def.gravityZones) {
    const colour = g.kind === 'low' ? '#2b78d6' : '#d6702b';
    polygon(g.polygon, `fill="${colour}" fill-opacity="0.12" stroke="${colour}" stroke-width="2" stroke-dasharray="8 5"`);
    const first = g.polygon[0]!;
    label(first.xM, first.zM, `${g.kind} gravity`, `fill="${colour}"`);
  }

  // Roads: the run-off strip (the walls stand at its edge), then the road in its surface colour, then the centreline.
  for (const road of world.roads) {
    const pts = road.line.points;
    polyline(pts, `stroke="${SURFACE_COLOURS[road.runoffSurfaceId] ?? '#d8b878'}" stroke-opacity="0.55" stroke-width="${R(road.widthM + road.runoffM * 2)}"`);
  }
  for (const road of world.roads) {
    const pts = road.line.points;
    polyline(pts, `stroke="${SURFACE_COLOURS[road.surfaceId] ?? ROAD_FALLBACK}" stroke-width="${R(road.widthM)}"`);
    polyline(pts, 'stroke="#f4f1e8" stroke-opacity="0.7" stroke-width="1" stroke-dasharray="8 8"');
    const mid = pts[Math.floor(pts.length / 2)]!;
    label(mid.xM, mid.zM, road.def.name ?? road.def.id, 'text-anchor="middle" font-weight="bold"');
  }

  // Markers.
  for (const f of def.forks) {
    const a = f.line.headingDeg * DEG;
    const dx = -Math.sin(a) * (f.line.widthM / 2);
    const dz = Math.cos(a) * (f.line.widthM / 2);
    push(`<line x1="${X(f.line.xM - dx)}" y1="${Y(f.line.zM - dz)}" x2="${X(f.line.xM + dx)}" y2="${Y(f.line.zM + dz)}" stroke="#7a2bd6" stroke-width="3" stroke-dasharray="5 3"/>`);
    label(f.line.xM, f.line.zM, `${f.id} start`, 'fill="#7a2bd6"');
    push(`<circle cx="${X(f.mergeAt.xM)}" cy="${Y(f.mergeAt.zM)}" r="${R(f.mergeAt.radiusM)}" fill="none" stroke="#7a2bd6" stroke-width="2"/>`);
    label(f.mergeAt.xM, f.mergeAt.zM, `${f.id} merge`, 'fill="#7a2bd6"');
  }
  for (const bar of def.barriers) {
    const h = bar.headingDeg * DEG;
    const corner = (u: number, v: number): PointM => ({ xM: bar.xM + Math.cos(h) * u - Math.sin(h) * v, zM: bar.zM + Math.sin(h) * u + Math.cos(h) * v });
    polygon([corner(-bar.lengthM / 2, -bar.widthM / 2), corner(bar.lengthM / 2, -bar.widthM / 2), corner(bar.lengthM / 2, bar.widthM / 2), corner(-bar.lengthM / 2, bar.widthM / 2)], 'fill="#c0392b" stroke="#7a1d12"');
  }
  for (const p of def.boosts) {
    push(`<circle cx="${X(p.xM)}" cy="${Y(p.zM)}" r="${R(p.radiusM)}" fill="#34c759" fill-opacity="0.7" stroke="#1e7a36"/>`);
    label(p.xM, p.zM, 'boost');
  }
  for (const c of def.cannons) {
    const a = c.directionDeg * DEG;
    push(`<circle cx="${X(c.xM)}" cy="${Y(c.zM)}" r="6" fill="#444"/>`);
    push(`<line x1="${X(c.xM)}" y1="${Y(c.zM)}" x2="${X(c.xM + Math.cos(a) * 12)}" y2="${Y(c.zM + Math.sin(a) * 12)}" stroke="#444" stroke-width="3"/>`);
    label(c.xM, c.zM, c.kind === 'headOn' ? 'cannon (head-on)' : 'cannon (kicker)');
  }
  for (const p of def.pylons) {
    push(`<circle cx="${X(p.xM)}" cy="${Y(p.zM)}" r="7" fill="${p.pole === 'N' ? '#d63b2b' : '#2b6fd6'}" stroke="#fff" stroke-width="2"/>`);
    label(p.xM, p.zM, `${p.id} ${p.pole}${p.switching ? ' ⟲' : ''}`);
  }
  for (const s of def.signs) {
    push(`<rect x="${n1(Number(X(s.xM)) - 5)}" y="${n1(Number(Y(s.zM)) - 5)}" width="10" height="10" fill="#f2c14e" stroke="#7a5b0c"/>`);
    label(s.xM, s.zM, `sign r ${s.radiusM}`);
  }
  def.checkpoints.forEach((c, i) => {
    push(`<circle cx="${X(c.xM)}" cy="${Y(c.zM)}" r="${R(c.radiusM ?? 6)}" fill="#00a6a6" fill-opacity="0.2" stroke="#00797a"/>`);
    label(c.xM, c.zM, `cp ${i + 1}`, 'fill="#00797a"');
  });
  for (const s of def.samples) {
    push(`<circle cx="${X(s.xM)}" cy="${Y(s.zM)}" r="6" fill="#ffd23f" stroke="#8a6d00" stroke-width="2"/>`);
    label(s.xM, s.zM, s.id);
  }
  const a = def.start.headingDeg * DEG;
  push(`<line x1="${X(def.start.xM)}" y1="${Y(def.start.zM)}" x2="${X(def.start.xM + Math.cos(a) * 14)}" y2="${Y(def.start.zM + Math.sin(a) * 14)}" stroke="#1e8a3a" stroke-width="4"/>`);
  push(`<circle cx="${X(def.start.xM)}" cy="${Y(def.start.zM)}" r="7" fill="#1e8a3a"/>`);
  label(def.start.xM, def.start.zM, 'start', 'font-weight="bold"');
  push(`<circle cx="${X(def.finish.xM)}" cy="${Y(def.finish.zM)}" r="${R(def.finish.radiusM)}" fill="#ffe08a" fill-opacity="0.6" stroke="#b8860b" stroke-width="3"/>`);
  label(def.finish.xM, def.finish.zM, 'finish', 'font-weight="bold"');

  // Title and scale bar.
  push(`<text x="12" y="24" font-size="20" font-family="sans-serif" font-weight="bold" fill="#10131a">${esc(def.name)} (${def.id})</text>`);
  push(`<text x="12" y="44" font-size="12" font-family="sans-serif" fill="#3a3f4b">${world.roads.length} roads · ${def.checkpoints.length} checkpoints · ${def.forks.length} forks · par ${def.parS} s · x to the right, z up</text>`);
  const barM = 100;
  push(`<rect x="12" y="${heightPx - 34}" width="${R(barM)}" height="6" fill="#10131a"/>`);
  push(`<text x="12" y="${heightPx - 40}" font-size="11" font-family="sans-serif" fill="#10131a">${barM} m</text>`);
  push('</svg>');
  return out.join('\n');
}

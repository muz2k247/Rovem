import type { Content, Level, PointM, Rock } from '../content/index.ts';
import type { SurfaceSpec } from '../physics/types.ts';
import { surfaceSpec } from './buildFromParts.ts';
import { footprintOverlapsCircle, pointInPolygon } from './geometry.ts';

/** The rover's footprint on the ground, for rocks: length × width (DECISIONS 2026-10-13). */
export interface Footprint {
  lengthM: number;
  widthM: number;
}

/** A level ready to drive: the game layer's view of the map, so `physics/` stays free of it. */
export interface Track {
  level: Level;
  footprint: Footprint;
  /** Start pose in physics terms: the rover's front and its heading. */
  start: { positionXM: number; positionZM: number; headingRad: number };
  /** The ideal line (assist and balance). */
  path: readonly PointM[];
  surfaceIdAt(xM: number, zM: number): string;
  /** The surface under a point: the last region that covers it, else the level's default. */
  surfaceAt(xM: number, zM: number): SurfaceSpec;
  /** The first rock the footprint overlaps, with the front at (x, z) facing `headingRad`; undefined if clear. */
  rockHit(xM: number, zM: number, headingRad: number): Rock | undefined;
}

export function createTrack(content: Content, level: Level): Track {
  const footprint = { lengthM: content.constants.roverLengthM, widthM: content.constants.roverWidthM };
  const specs = new Map(content.surfaces.map((s) => [s.id, surfaceSpec(content, s.id)]));
  const surfaceIdAt = (xM: number, zM: number): string => {
    for (let i = level.surfaces.length - 1; i >= 0; i--) {
      const region = level.surfaces[i]!;
      if (pointInPolygon(xM, zM, region.polygon)) return region.surfaceId;
    }
    return level.defaultSurfaceId;
  };
  return {
    level,
    footprint,
    start: { positionXM: level.start.xM, positionZM: level.start.zM, headingRad: (level.start.headingDeg * Math.PI) / 180 },
    path: level.path,
    surfaceIdAt,
    surfaceAt: (xM, zM) => specs.get(surfaceIdAt(xM, zM))!,
    rockHit: (xM, zM, headingRad) =>
      level.props.find((rock) =>
        footprintOverlapsCircle(xM, zM, headingRad, footprint.lengthM, footprint.widthM, rock.xM, rock.zM, rock.radiusM),
      ),
  };
}

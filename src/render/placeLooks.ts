// How each Endless place looks (SHOWCASE_PLAN §11, §12): daylight on a red planet, with the sky, the haze, the canyon walls and
// the entry banner each place's own, so a run reads as a journey through places. Presentation only (colours); the scene
// eases from one look to the next as the rover crosses an entry post.

export interface PlaceLook {
  /** The sky and the distant haze (the fog takes the same colour). */
  sky: number;
  /** The canyon walls. */
  wall: number;
  /** The colour of bare rock on the canyon floor. */
  rock: number;
  /** The entry post's banner. */
  banner: string;
}

/** Plain daylight, used at the start and for a place nobody described. */
export const DAYLIGHT: PlaceLook = { sky: 0xd9a27a, wall: 0x7a3a24, rock: 0x7a4a38, banner: '#7a3a24' };

export const PLACE_LOOKS: Readonly<Record<string, PlaceLook>> = {
  start: DAYLIGHT,
  'rock-plain': { sky: 0xd9a27a, wall: 0x7a3a24, rock: 0x7a4a38, banner: '#8a4a2c' },
  'dune-sea': { sky: 0xe6bd84, wall: 0xa86a3c, rock: 0x8a5a40, banner: '#b0792c' },
  'frozen-flats': { sky: 0xb7cbd8, wall: 0x6a6f86, rock: 0x6c5a58, banner: '#3d6f9a' },
  'clay-gully': { sky: 0xc79a7c, wall: 0x5c3426, rock: 0x6a4234, banner: '#6a4a2a' },
  'vent-run': { sky: 0xe0925e, wall: 0x8a3e22, rock: 0x7a4430, banner: '#c0502a' },
  'launcher-alley': { sky: 0xcfab92, wall: 0x6b6a74, rock: 0x6e5448, banner: '#4a5468' },
  'gravity-caves': { sky: 0xb88f78, wall: 0x59546a, rock: 0x62463c, banner: '#5a3c8a' },
};

export const placeLook = (place: string): PlaceLook => PLACE_LOOKS[place] ?? DAYLIGHT;

/** The look of the section the rover is in (or daylight where there is none). */
export const lookAt = (section: { place: string } | undefined): PlaceLook => (section ? placeLook(section.place) : DAYLIGHT);

const mixChannel = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const mixColour = (a: number, b: number, t: number) =>
  (mixChannel((a >> 16) & 255, (b >> 16) & 255, t) << 16) | (mixChannel((a >> 8) & 255, (b >> 8) & 255, t) << 8) | mixChannel(a & 255, b & 255, t);

/** `t` from 0 (the look `a`) to 1 (the look `b`); the banner is not mixed, it belongs to the place being entered. */
export function mixLook(a: PlaceLook, b: PlaceLook, t: number): PlaceLook {
  const k = Math.min(1, Math.max(0, t));
  return { sky: mixColour(a.sky, b.sky, k), wall: mixColour(a.wall, b.wall, k), rock: mixColour(a.rock, b.rock, k), banner: k < 0.5 ? a.banner : b.banner };
}

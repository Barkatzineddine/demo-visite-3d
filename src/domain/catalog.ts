// Verlaine Immobilier (fictional agency) and the listing it presents, the finishes a buyer can try
// and the lighting moods. Colours are linear-friendly sRGB hex; textures live in public/textures.
import type { RoomId } from './apartment';

export const AGENCY = {
  name: 'Verlaine Immobilier',
  address: '18 avenue Jean-Jaurès',
  zip: '69007',
  city: 'Lyon',
  phone: '04 65 71 52 20',
  email: 'contact@verlaine-immobilier.example',
  card: 'Carte professionnelle CPI 6901 2026 000 000 000 (fictive)',
  siret: '913 456 789 00012',
} as const;

export const LISTING = {
  ref: 'VL-T3-0716',
  title: 'T3 traversant avec balcon, Lyon 7e',
  address: 'Résidence Les Tilleuls, rue Domer, 69007 Lyon',
  floor: '3e étage sur 5, avec ascenseur',
  built: 2019,
  /** Euros, agency fees included. */
  price: 389_000,
  charges: 1_860,
  tax: 1_120,
  dpe: 'B',
  ges: 'A',
  exposure: 'Sud-ouest',
} as const;

export const FLOOR_IDS = ['chene', 'carrelage', 'beton'] as const;
export type FloorId = (typeof FLOOR_IDS)[number];
export const WALL_IDS = ['blanc', 'lin', 'sauge', 'bleu', 'terre'] as const;
export type WallId = (typeof WALL_IDS)[number];
export const FRONT_IDS = ['blanc', 'chene', 'sauge', 'noir'] as const;
export type FrontId = (typeof FRONT_IDS)[number];
export const TOP_IDS = ['quartz', 'chene', 'beton'] as const;
export type TopId = (typeof TOP_IDS)[number];
export const LIGHT_IDS = ['matin', 'apres-midi', 'coucher', 'nuit'] as const;
export type LightId = (typeof LIGHT_IDS)[number];

export interface FloorFinish { texture: string; repeat: number; tint: string; roughness: number }
export const FLOORS: Record<FloorId, FloorFinish> = {
  chene: { texture: 'parquet', repeat: 1.6, tint: '#ffffff', roughness: 1 },
  carrelage: { texture: 'carrelage', repeat: 1.2, tint: '#ffffff', roughness: 1 },
  beton: { texture: 'beton', repeat: 2.5, tint: '#ffffff', roughness: 1 },
};

export const WALL_COLORS: Record<WallId, string> = { blanc: '#f1eee8', lin: '#e6dccb', sauge: '#b9c3ad', bleu: '#a9b4bd', terre: '#d6a68c' };
export const FRONT_COLORS: Record<FrontId, string> = { blanc: '#eeece7', chene: '#ffffff', sauge: '#8f9c80', noir: '#2b2b2b' };
export const TOP_COLORS: Record<TopId, string> = { quartz: '#ffffff', chene: '#ffffff', beton: '#ffffff' };

export interface Lighting {
  /** Sun direction: degrees from north, clockwise, and above the horizon. */
  azimuth: number;
  elevation: number;
  sun: string;
  intensity: number;
  /** Sky model: haze and the exposure that keeps interiors readable. */
  turbidity: number;
  exposure: number;
  /** Lamps on (ceiling, floor and bedside lamps). */
  lamps: boolean;
}

export const LIGHTINGS: Record<LightId, Lighting> = {
  matin: { azimuth: 105, elevation: 18, sun: '#ffe6c4', intensity: 3.2, turbidity: 6, exposure: 1.1, lamps: false },
  'apres-midi': { azimuth: 200, elevation: 42, sun: '#fff4e2', intensity: 4.2, turbidity: 4, exposure: 1.05, lamps: false },
  coucher: { azimuth: 262, elevation: 7, sun: '#ffc590', intensity: 3.0, turbidity: 8, exposure: 1.0, lamps: true },
  nuit: { azimuth: 300, elevation: -12, sun: '#9fb6ff', intensity: 0, turbidity: 2, exposure: 1.0, lamps: true },
};

export interface Hotspot { id: string; room: RoomId; at: [number, number, number] }
/** Points of interest in the visit; their text is in the dictionaries (hotspot.<id>.title / .text). */
export const HOTSPOTS: Hotspot[] = [
  { id: 'cuisine', room: 'sejour', at: [0.6, 1.35, 3.3] },
  { id: 'baie', room: 'sejour', at: [2.5, 1.9, 7.15] },
  { id: 'sol', room: 'sejour', at: [2.9, 0.02, 3.3] },
  { id: 'balcon', room: 'sejour', at: [3.2, 1.2, 8.2] },
  { id: 'suite', room: 'chambre1', at: [9.55, 1.6, 1.85] },
  { id: 'bureau', room: 'chambre2', at: [8.6, 1.2, 7.1] },
  { id: 'douche', room: 'sdb', at: [0.55, 1.7, 1.5] },
  { id: 'rangements', room: 'placard', at: [5.55, 1.6, 2.0] },
  { id: 'entree', room: 'entree', at: [3.35, 2.1, 0.05] },
];

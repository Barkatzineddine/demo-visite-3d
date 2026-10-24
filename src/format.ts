// Display helpers that depend on the current language: areas, lengths, prices and the names of
// rooms, views and finishes (stored as ids, written out here).
import { useCallback } from 'react';
import type { RoomId } from './domain/apartment';
import type { LightId } from './domain/catalog';
import type { View } from './domain/schema';
import { useI18n, type Key } from './i18n';

export function useFormat() {
  const i18n = useI18n();
  const { t, locale } = i18n;
  const num = useCallback((n: number, digits = 0) => n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }), [locale]);
  const m2 = useCallback((n: number, digits = 1) => `${num(n, digits)}\u202fm²`, [num]);
  const euros = useCallback((n: number) => i18n.money(n, 0), [i18n]);
  const room = useCallback((id: RoomId | 'balcon') => t(`room.${id}` as Key), [t]);
  const view = useCallback((v: View) => (v === 'maquette' ? t('tour.maquette') : t(`room.${v}` as Key)), [t]);
  const light = useCallback((id: LightId) => t(`light.${id}` as Key), [t]);
  const finish = useCallback((kind: 'floor' | 'walls' | 'fronts' | 'top', id: string) => t(`${kind}.${id}` as Key), [t]);
  const day = useCallback((d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d), [locale]);
  return { ...i18n, num, m2, euros, room, view, light, finish, day };
}

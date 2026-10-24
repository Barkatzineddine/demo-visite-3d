import { useCallback } from 'react';
import { balconyArea, ROOMS, roomArea, type RoomId } from '../domain/apartment';
import { useFormat } from '../format';
import type { Key } from '../i18n';

const area = (id: RoomId) => { const r = ROOMS.find((x) => x.id === id); return r ? roomArea(r) : 0; };
/** The area quoted in each hotspot's text, from the plan rather than typed in the dictionaries. */
const AREAS: Record<string, () => number> = { balcon: balconyArea, suite: () => area('chambre1'), bureau: () => area('chambre2'), rangements: () => area('placard') };

export function useHotspotText() {
  const { t, num } = useFormat();
  return useCallback((id: string) => {
    const a = AREAS[id];
    const vars = a ? { area: num(a(), 1) } : undefined;
    return { title: t(`hotspot.${id}.title` as Key, vars), text: t(`hotspot.${id}.text` as Key, vars) };
  }, [t, num]);
}

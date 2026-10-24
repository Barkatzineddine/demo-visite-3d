// The floor plan in SVG: the full plan (names, areas, north, scale) or the small one in the tour,
// where the rooms are buttons and a marker shows where the visitor stands and looks.
import { memo, type KeyboardEvent } from 'react';
import type { RoomId } from '../domain/apartment';
import { LABEL_OFFSET, planGeometry, type Box } from '../domain/plan';
import type { Pose } from '../engine/Engine';
import { useFormat } from '../format';

const rectPath = (b: Box) => `M${b.x.toFixed(3)} ${b.y.toFixed(3)}h${b.w.toFixed(3)}v${b.h.toFixed(3)}h${(-b.w).toFixed(3)}z`;
const GEOMETRY = planGeometry();
const WALLS_PATH = GEOMETRY.walls.map((b) => rectPath(b)).join('');
const TILED = new Set<RoomId>(['sdb', 'wc']);

interface Props {
  mini?: boolean;
  current?: RoomId | null;
  pose?: Pose | null;
  onRoom?: (id: RoomId) => void;
  label: string;
}

export const Plan = memo(function Plan({ mini = false, current = null, pose = null, onRoom, label }: Props) {
  const { room, m2, num, t } = useFormat();
  const g = GEOMETRY;
  const walls = WALLS_PATH;
  const v = g.view;
  const key = (id: RoomId) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRoom?.(id); } };

  return (
    <svg className={mini ? 'plan plan-mini' : 'plan'} viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} role={onRoom ? 'group' : 'img'} aria-label={label}>
      <rect className="plan-balcony" x={g.balcony.x} y={g.balcony.y} width={g.balcony.w} height={g.balcony.h} />
      {!mini ? (
        <text className="plan-name" x={g.balcony.x + g.balcony.w / 2} y={g.balcony.y + g.balcony.h / 2 + 0.1} textAnchor="middle">{room('balcon')}</text>
      ) : null}
      {g.rooms.map((r) => {
        const [nx, ny] = LABEL_OFFSET[r.id] ?? [0, 0];
        const cx = r.box.x + r.box.w / 2 + nx;
        const cy = r.box.y + r.box.h / 2 + ny;
        const small = r.box.w < 1.5;
        const body = (
          <>
            <rect className={`plan-room${TILED.has(r.id) ? ' plan-tiled' : ''}`} x={r.box.x} y={r.box.y} width={r.box.w} height={r.box.h} />
            {!mini ? (
              <>
                <text className={small ? 'plan-name plan-small' : 'plan-name'} x={cx} y={cy - (small ? 0.02 : 0.08)} textAnchor="middle">{room(r.id)}</text>
                <text className={small ? 'plan-area plan-small' : 'plan-area'} x={cx} y={cy + (small ? 0.24 : 0.36)} textAnchor="middle">{m2(r.area, 2)}</text>
                {!small ? <text className="plan-dims" x={cx} y={cy + 0.7} textAnchor="middle">{t('plan.dims', { w: num(r.width, 2), d: num(r.depth, 2) })}</text> : null}
              </>
            ) : null}
          </>
        );
        if (!onRoom) return <g key={r.id} data-current={current === r.id || undefined}>{body}</g>;
        return (
          <g key={r.id} className="plan-hit" role="button" tabIndex={0} aria-label={room(r.id)} aria-current={current === r.id ? 'location' : undefined}
            data-current={current === r.id || undefined} onClick={() => { onRoom(r.id); }} onKeyDown={key(r.id)}>
            <title>{room(r.id)}</title>
            {body}
          </g>
        );
      })}
      <path className="plan-wall" d={walls} />
      {g.windows.map((w, i) => (
        <g key={i} className="plan-window">
          <rect x={w.x} y={w.y} width={w.w} height={w.h} />
          {w.w > w.h ? <line x1={w.x} x2={w.x + w.w} y1={w.y + w.h / 2} y2={w.y + w.h / 2} /> : <line y1={w.y} y2={w.y + w.h} x1={w.x + w.w / 2} x2={w.x + w.w / 2} />}
        </g>
      ))}
      {g.sliders.map((s, i) => <rect key={i} className="plan-slider" x={s.x} y={s.y} width={s.w} height={s.h} />)}
      {g.doors.map((d, i) => (
        <path key={i} className="plan-door" d={`M${d.hinge[0]} ${d.hinge[1]}L${d.open[0]} ${d.open[1]}A${d.radius} ${d.radius} 0 0 ${d.sweep} ${d.closed[0]} ${d.closed[1]}`} />
      ))}
      {pose ? <Marker pose={pose} /> : null}
      {!mini ? (
        <>
          <g className="plan-north" transform={`translate(${v.x + v.w - 0.6} ${v.y + v.h - 0.9})`}>
            <path d="M0 -0.42L0.2 0.18L0 0.06L-0.2 0.18Z" />
            <text y={0.52} textAnchor="middle">{t('plan.north').charAt(0)}</text>
          </g>
          <g className="plan-scale" transform={`translate(${v.x + 0.35} ${v.y + v.h - 0.35})`}>
            <path d="M0 -0.1V0H1V-0.1" />
            <text x={0.5} y={-0.18} textAnchor="middle">{t('plan.scale')}</text>
          </g>
        </>
      ) : null}
    </svg>
  );
});

/** The visitor: a dot and the field of view, turned with the camera (yaw 0 looks north, −z). */
function Marker({ pose }: { pose: Pose }) {
  const deg = (-pose.yaw * 180) / Math.PI;
  return (
    <g className="plan-marker" transform={`translate(${pose.x.toFixed(2)} ${pose.z.toFixed(2)}) rotate(${deg.toFixed(1)})`}>
      <path className="plan-cone" d="M0 0L-0.75 -1.3A1.5 1.5 0 0 1 0.75 -1.3Z" />
      <circle r={0.2} />
    </g>
  );
}

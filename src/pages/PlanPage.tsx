// The floor plan with each room's size and area (Carrez law), and a link into the tour per room.
import { balconyArea, carrez } from '../domain/apartment';
import { AGENCY } from '../domain/catalog';
import { planGeometry } from '../domain/plan';
import { encodeChoices } from '../domain/schema';
import { useFormat } from '../format';
import { Link, usePage } from '../shared/router';
import { useChoices } from '../state/choices';
import { Plan } from '../ui/Plan';

const rooms = [...planGeometry().rooms].sort((a, b) => b.area - a.area);

export default function PlanPage() {
  const { t, m2, num, room } = useFormat();
  const choices = useChoices((s) => s.choices);
  usePage(`${t('plan.title')} · ${AGENCY.name}`);
  return (
    <>
      <header className="page-head">
        <h1 tabIndex={-1}>{t('plan.title')}</h1>
        <p className="lead">{t('plan.lead')}</p>
      </header>
      <div className="plan-layout">
        <figure className="panel plan-figure">
          <Plan label={t('plan.alt', { carrez: num(carrez(), 1) })} />
        </figure>
        <section className="panel" aria-labelledby="areas">
          <h2 id="areas" className="panel-title">{t('plan.areas')}</h2>
          <table className="areas">
            <thead><tr><th scope="col">{t('plan.room')}</th><th scope="col" className="num">{t('plan.size')}</th><th scope="col" className="num">{t('plan.area')}</th><th scope="col"><span className="sr">{t('plan.open3d')}</span></th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{room(r.id)}</th>
                  <td className="num">{t('plan.dims', { w: num(r.width, 2), d: num(r.depth, 2) })}</td>
                  <td className="num">{m2(r.area, 2)}</td>
                  <td className="num"><Link to={`/?${encodeChoices({ ...choices, view: r.id })}`} aria-label={`${t('plan.open3d')}, ${room(r.id)}`}>{t('plan.open3d')}</Link></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total"><th scope="row" colSpan={2}>{t('plan.total')}</th><td className="num">{m2(carrez(), 2)}</td><td /></tr>
              <tr><th scope="row" colSpan={2} className="muted">{t('plan.balcony')}</th><td className="num muted">{m2(balconyArea(), 2)}</td><td /></tr>
            </tfoot>
          </table>
          <p className="hint">{t('plan.note')}</p>
        </section>
      </div>
    </>
  );
}

import Panel from '../components/Panel.jsx';
import { api } from '../api.js';
import { fmt } from '../utils.js';

export default function Upcycle({ data, busy, act, canManage }) {
  const groundKg = data.stations?.flatMap((s) => Object.values(s.bins || {})).filter((b) => b.grindable).reduce((n, b) => n + Number(b.weight || 0), 0) || 0;
  const notify = (target) => act(() => api('/api/upcycle-notifications', { method: 'POST', body: { target } }), `Notification added for ${target}.`);
  return <><div className="section-intro"><div><p className="eyebrow">Material reuse</p><h2>Upcycled output</h2><p>Estimates based on ground plastic currently in the bins.</p></div></div><div className="output-summary"><span>Measured ground plastic</span><strong>{fmt(groundKg)} kg</strong></div><div className="output-grid">{data.upcycleYield?.map((item) => <article className="output-card" key={item.product}><span className="output-icon" aria-hidden="true">{item.icon}</span><h3>{item.product}</h3><p>{item.note}</p><strong>About {fmt(groundKg / item.kgPerUnit, 0)} units</strong></article>)}</div><Panel title="Share an estimate"><p className="muted">Adds a notification to this portal. No message is sent outside it.</p>{canManage ? <div className="inline-actions"><button className="button" disabled={busy || !groundKg} onClick={() => notify('residents')}>Add resident notification</button><button className="button outline" disabled={busy || !groundKg} onClick={() => notify('partner')}>Add partner notification</button></div> : <p className="muted">A supervisor or administrator can add a notification.</p>}</Panel></>;
}

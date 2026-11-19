import { useState } from 'react';
import Panel from '../components/Panel.jsx';
import Badge from '../components/Badge.jsx';
import Empty from '../components/Empty.jsx';
import { api } from '../api.js';
import { when } from '../utils.js';

export default function Grinding({ data, busy, act, canManage }) {
  const [form, setForm] = useState({ station: data.stations?.[0]?.id || '', bins: [], scheduledFor: '', assignedStaff: '', note: '' });
  const sched = data.grindingSchedules || [];
  const grindableBins = data.stations?.find((s) => s.id === form.station)?.bins || {};
  const toggleBin = (id) => setForm((old) => ({ ...old, bins: old.bins.includes(id) ? old.bins.filter((x) => x !== id) : [...old.bins, id] }));
  const submit = async (e) => { e.preventDefault(); if (await act(() => api('/api/grinding-schedules', { method: 'POST', body: form }), 'Grinding schedule added.')) setForm((old) => ({ ...old, bins: [], scheduledFor: '', assignedStaff: '', note: '' })); };
  const update = (id, status) => act(() => api(`/api/grinding-schedules/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } }), `Schedule marked ${status}.`);
  return <>
    <div className="section-intro"><div><p className="eyebrow">Collection planning</p><h2>Grinding schedule</h2><p>Plan work only for grindable kiosk sections.</p></div></div>
    {!canManage && <Panel title="Supervisor access required"><p className="muted">A supervisor or administrator can manage grinding schedules.</p></Panel>}
    {canManage && <div className="two-col schedule-layout">
      <Panel title="Add schedule"><form className="stack-form" onSubmit={submit}>
        <label>Kiosk<select value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value, bins: [] })}>{data.stations?.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.location}</option>)}</select></label>
        <fieldset><legend>Sections to grind</legend><div className="check-list">{Object.entries(grindableBins).filter(([, b]) => b.grindable).map(([id, b]) => <label className="check-row" key={id}><input type="checkbox" checked={form.bins.includes(id)} onChange={() => toggleBin(id)} /><span>{id.toUpperCase()} · {b.label}</span></label>)}</div></fieldset>
        <label>Schedule for<input type="datetime-local" required value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} /></label>
        <label>Assigned staff<input required value={form.assignedStaff} onChange={(e) => setForm({ ...form, assignedStaff: e.target.value })} placeholder="Staff name" /></label>
        <label>Note <textarea rows="2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional details" /></label>
        <button className="button" disabled={busy || !form.bins.length}>Add to schedule</button>
      </form></Panel>
      <Panel title="Upcoming and recent"><div className="schedule-list">{sched.length ? sched.map((item) => <article className="schedule-item" key={item.id}><div className="schedule-head"><div><strong>{item.id} · {item.station}</strong><small>{(item.bins || []).map((b) => b.toUpperCase()).join(', ')} · {when(item.scheduledFor)}</small></div><Badge tone={item.status === 'completed' ? 'good' : item.status === 'missed' ? 'alert' : ''}>{item.status}</Badge></div><p>{item.assignedStaff}{item.note ? ` · ${item.note}` : ''}</p>{item.status === 'scheduled' && <div className="inline-actions"><button className="button small" disabled={busy} onClick={() => update(item.id, 'completed')}>Mark completed</button><button className="button outline small" disabled={busy} onClick={() => update(item.id, 'missed')}>Mark missed</button></div>}</article>) : <Empty>No grinding schedules yet.</Empty>}</div></Panel>
    </div>}
  </>;
}

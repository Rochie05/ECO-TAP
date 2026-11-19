import { useMemo, useState } from 'react';
import Panel from '../components/Panel.jsx';
import Badge from '../components/Badge.jsx';
import Empty from '../components/Empty.jsx';
import { api } from '../api.js';
import { fmt } from '../utils.js';

// Monitor User Accounts (residents): view, modify, terminate, delete.
export default function Residents({ data, busy, act, canEdit }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const residents = data.residents || [];
  const list = useMemo(() => residents.filter((r) => [r.id, r.name, r.nfcCardId, r.address, r.phone].join(' ').toLowerCase().includes(query.toLowerCase())), [residents, query]);
  const url = (id) => `/api/residents/${encodeURIComponent(id)}`;
  const save = async (e) => {
    e.preventDefault();
    const { id, name, address, phone } = editing;
    if (await act(() => api(url(id), { method: 'PATCH', body: { name, address, phone } }), `Account ${id} updated.`)) setEditing(null);
  };
  const resetPin = (r) => {
    const pin = window.prompt(`New 6-digit PIN for ${r.name}:`);
    if (!pin) return;
    if (!/^\d{6}$/.test(pin)) { window.alert('PIN must be exactly 6 digits.'); return; }
    act(() => api(url(r.id), { method: 'PATCH', body: { pin } }), `PIN reset for ${r.name}.`);
  };
  const setStatus = (r, status) => {
    if (status === 'terminated' && !window.confirm(`Terminate ${r.name}'s account? The card will stop working until it is reactivated.`)) return;
    act(() => api(url(r.id), { method: 'PATCH', body: { status } }), status === 'terminated' ? `${r.name}'s account terminated.` : `${r.name}'s account reactivated.`);
  };
  const remove = (r) => {
    if (window.confirm(`Delete ${r.name} (${r.id})? Their points history and redemptions are removed. This cannot be undone.`)) act(() => api(url(r.id), { method: 'DELETE' }), `Account ${r.id} deleted.`);
  };
  return <>
    <div className="section-intro"><div><p className="eyebrow">Monitor user accounts</p><h2>Resident accounts</h2><p>{residents.length} registered NFC cards. {canEdit ? 'Edit, terminate or delete accounts below.' : 'Administrators can edit, terminate or delete accounts.'}</p></div>
      <label className="search-field"><span className="sr-only">Search residents</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search residents" /></label></div>
    <div className="two-col">
      <Panel title="All residents"><div className="schedule-list">{list.length ? list.map((r) => <article className="schedule-item" key={r.id}>
        <div className="schedule-head"><div><strong>{r.name}</strong><small>{r.id} · {r.nfcCardId || 'no card'}</small></div><Badge tone={r.status === 'terminated' ? 'crit' : 'good'}>{r.status === 'terminated' ? 'Terminated' : 'Active'}</Badge></div>
        <p>{fmt(r.points, 0)} points{r.address ? ` · ${r.address}` : ''}{r.phone ? ` · ${r.phone}` : ''}{r.registeredAt ? ` · since ${r.registeredAt}` : ''}</p>
        {canEdit && <div className="inline-actions">
          <button className="button outline small" disabled={busy} onClick={() => setEditing({ id: r.id, name: r.name, address: r.address, phone: r.phone })}>Edit</button>
          <button className="button outline small" disabled={busy} onClick={() => resetPin(r)}>Reset PIN</button>
          <button className="button outline small" disabled={busy} onClick={() => setStatus(r, r.status === 'terminated' ? 'active' : 'terminated')}>{r.status === 'terminated' ? 'Reactivate' : 'Terminate'}</button>
          <button className="button outline small" disabled={busy} onClick={() => remove(r)}>Delete</button>
        </div>}
      </article>) : <Empty>{residents.length ? 'No residents match your search.' : 'No residents yet. Residents register by tapping a new card at a kiosk.'}</Empty>}</div></Panel>
      {editing && <Panel title={`Edit ${editing.id}`}><form className="stack-form" onSubmit={save}>
        <label>Full name<input required maxLength={100} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
        <label>Address<input maxLength={200} value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></label>
        <label>Phone<input maxLength={40} value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></label>
        <div className="inline-actions"><button className="button" disabled={busy}>Save changes</button><button type="button" className="button outline" onClick={() => setEditing(null)}>Cancel</button></div>
      </form></Panel>}
    </div>
  </>;
}

import { useState } from 'react';
import Panel from '../components/Panel.jsx';
import Badge from '../components/Badge.jsx';
import Empty from '../components/Empty.jsx';
import { api } from '../api.js';

const ROLES = ['Collector', 'Supervisor', 'Administrator'];
const blank = { username: '', name: '', role: 'Collector', password: '', collectorCardUid: '', assignedKiosks: [] };

export default function Accounts({ data, busy, act, isSuperadmin }) {
  const [form, setForm] = useState(blank);
  const users = data.users || [];
  const stations = data.stations || [];
  const roles = isSuperadmin ? ROLES : ROLES.filter((role) => role !== 'Administrator');
  const create = async (e) => {
    e.preventDefault();
    if (await act(() => api('/api/users', { method: 'POST', body: form }), `Account “${form.username.trim().toLowerCase()}” created.`)) setForm(blank);
  };
  const setRole = (account, role) => {
    const body = { role };
    if (account.role === 'Collector' && role !== 'Collector') {
      const password = window.prompt('Set a temporary password for portal access (at least 8 characters):');
      if (!password) return;
      body.password = password;
    }
    act(() => api(`/api/users/${encodeURIComponent(account.username)}`, { method: 'PATCH', body }), `Role updated for ${account.username}.`);
  };
  const resetPassword = (username) => {
    const password = window.prompt(`New password for ${username} (at least 8 characters):`);
    if (password) act(() => api(`/api/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: { password } }), `Password changed for ${username}.`);
  };
  const rename = (account) => {
    const name = window.prompt(`Full name for ${account.username}:`, account.name);
    if (name && name.trim() && name.trim() !== account.name) act(() => api(`/api/users/${encodeURIComponent(account.username)}`, { method: 'PATCH', body: { name } }), `Name updated for ${account.username}.`);
  };
  const setStatus = (account, status) => {
    if (status === 'terminated' && !window.confirm(`Terminate “${account.username}”? They will be signed out and unable to sign in until reactivated.`)) return;
    act(() => api(`/api/users/${encodeURIComponent(account.username)}`, { method: 'PATCH', body: { status } }), status === 'terminated' ? `Account “${account.username}” terminated.` : `Account “${account.username}” reactivated.`);
  };
  const remove = (username) => {
    if (window.confirm(`Delete the account “${username}”? This cannot be undone.`)) act(() => api(`/api/users/${encodeURIComponent(username)}`, { method: 'DELETE' }), `Account “${username}” deleted.`);
  };
  return <>
    <div className="section-intro"><div><p className="eyebrow">Account management</p><h2>Accounts</h2><p>Set staff roles, assign kiosks, and enroll collector cards.</p></div></div>
    <div className="two-col">
      <Panel title="Create account"><form className="stack-form" onSubmit={create}>
        <label>Full name<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Username<input required maxLength={40} autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        {form.role === 'Collector' ? (
          <label>Collector card UID<input maxLength={80} autoComplete="off" value={form.collectorCardUid} onChange={(e) => setForm({ ...form, collectorCardUid: e.target.value })} /></label>
        ) : <label>Temporary password<input required type="password" minLength={8} maxLength={200} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>}
        <KioskAssignments stations={stations} selected={form.assignedKiosks} disabled={busy}
          onChange={(assignedKiosks) => setForm({ ...form, assignedKiosks })} />
        <button className="button" disabled={busy}>Create account</button>
      </form></Panel>
      <Panel title="All accounts"><div className="schedule-list">{users.length ? users.map((account) => <article className="schedule-item" key={account.username}>
        <div className="schedule-head"><div><strong>{account.name}</strong><small>{account.username}</small></div><div className="inline-actions flush"><Badge tone={account.role === 'Superadmin' ? 'good' : ''}>{account.role}</Badge>{account.status === 'terminated' && <Badge tone="crit">Terminated</Badge>}</div></div>
        {roles.includes(account.role) && <><div className="inline-actions">
          <select aria-label={`Role for ${account.username}`} value={account.role} disabled={busy} onChange={(e) => setRole(account, e.target.value)} style={{ width: 'auto' }}>{roles.map((role) => <option key={role}>{role}</option>)}</select>
          <button className="button outline small" disabled={busy} onClick={() => rename(account)}>Edit name</button>
          {account.role !== 'Collector' ? <button className="button outline small" disabled={busy} onClick={() => resetPassword(account.username)}>Reset password</button> : null}
          <button className="button outline small" disabled={busy} onClick={() => setStatus(account, account.status === 'terminated' ? 'active' : 'terminated')}>{account.status === 'terminated' ? 'Reactivate' : 'Terminate'}</button>
          {isSuperadmin ? <button className="button outline small" disabled={busy} onClick={() => remove(account.username)}>Delete</button> : null}
        </div>
        <AccountAccess key={JSON.stringify([account.role, account.collectorCardUid, account.assignedKiosks])}
          account={account} stations={stations} busy={busy} act={act} /></>}
      </article>) : <Empty>No accounts yet.</Empty>}</div></Panel>
    </div>
  </>;
}

function KioskAssignments({ stations, selected, disabled, onChange }) {
  return <fieldset>
    <legend>Assigned kiosks</legend>
    <select aria-label="Add assigned kiosk" value="" disabled={disabled || stations.every((station) => selected.includes(station.id))}
      onChange={(event) => onChange([...selected, event.target.value])}>
      <option value="" disabled>Choose a kiosk</option>
      {stations.filter((station) => !selected.includes(station.id)).map((station) => (
        <option key={station.id} value={station.id}>{station.id} · {station.location}</option>
      ))}
    </select>
    {selected.length ? <div className="inline-actions">{selected.map((id) => (
      <button className="button outline small" key={id} type="button" disabled={disabled}
        onClick={() => onChange(selected.filter((value) => value !== id))}>Remove {id}</button>
    ))}</div> : null}
  </fieldset>;
}

function AccountAccess({ account, stations, busy, act }) {
  const [assignedKiosks, setAssignedKiosks] = useState(account.assignedKiosks || []);
  const [collectorCardUid, setCollectorCardUid] = useState(account.collectorCardUid || '');
  const collector = account.role === 'Collector';
  const save = (event) => {
    event.preventDefault();
    const body = { assignedKiosks, ...(collector ? { collectorCardUid: collectorCardUid.trim() } : {}) };
    return act(() => api(`/api/users/${encodeURIComponent(account.username)}`, { method: 'PATCH', body }), 'Kiosk assignments saved.');
  };
  return <form className="stack-form" onSubmit={save}>
    {collector ? <label>Collector card UID<input maxLength={80} value={collectorCardUid} disabled={busy}
      onChange={(event) => setCollectorCardUid(event.target.value)} /></label> : null}
    <KioskAssignments stations={stations} selected={assignedKiosks} disabled={busy} onChange={setAssignedKiosks} />
    <button className="button outline small" disabled={busy}>Save kiosk assignments</button>
  </form>;
}

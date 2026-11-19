import { useState } from 'react';
import Panel from '../components/Panel.jsx';
import Badge from '../components/Badge.jsx';
import Empty from '../components/Empty.jsx';
import { api } from '../api.js';

const ROLES = ['Collector', 'Supervisor', 'Administrator'];
const blank = { username: '', name: '', role: 'Collector', password: '' };

export default function Accounts({ data, busy, act }) {
  const [form, setForm] = useState(blank);
  const users = data.users || [];
  const create = async (e) => {
    e.preventDefault();
    if (await act(() => api('/api/users', { method: 'POST', body: form }), `Account “${form.username.trim().toLowerCase()}” created.`)) setForm(blank);
  };
  const setRole = (username, role) => act(() => api(`/api/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: { role } }), `Role updated for ${username}.`);
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
    <div className="section-intro"><div><p className="eyebrow">Account management</p><h2>Accounts</h2><p>View, modify, terminate or delete staff sign-ins. Only the superadmin can see this page. Resident accounts are under Resident accounts.</p></div></div>
    <div className="two-col">
      <Panel title="Create account"><form className="stack-form" onSubmit={create}>
        <label>Full name<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Username<input required maxLength={40} autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
        <label>Temporary password<input required type="password" minLength={8} maxLength={200} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <button className="button" disabled={busy}>Create account</button>
      </form></Panel>
      <Panel title="All accounts"><div className="schedule-list">{users.length ? users.map((account) => <article className="schedule-item" key={account.username}>
        <div className="schedule-head"><div><strong>{account.name}</strong><small>{account.username}</small></div><div className="inline-actions flush"><Badge tone={account.role === 'Superadmin' ? 'good' : ''}>{account.role}</Badge>{account.status === 'terminated' && <Badge tone="crit">Terminated</Badge>}</div></div>
        {account.role !== 'Superadmin' && <div className="inline-actions">
          <select aria-label={`Role for ${account.username}`} value={account.role} disabled={busy} onChange={(e) => setRole(account.username, e.target.value)} style={{ width: 'auto' }}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select>
          <button className="button outline small" disabled={busy} onClick={() => rename(account)}>Edit name</button>
          <button className="button outline small" disabled={busy} onClick={() => resetPassword(account.username)}>Reset password</button>
          <button className="button outline small" disabled={busy} onClick={() => setStatus(account, account.status === 'terminated' ? 'active' : 'terminated')}>{account.status === 'terminated' ? 'Reactivate' : 'Terminate'}</button>
          <button className="button outline small" disabled={busy} onClick={() => remove(account.username)}>Delete</button>
        </div>}
      </article>) : <Empty>No accounts yet.</Empty>}</div></Panel>
    </div>
  </>;
}

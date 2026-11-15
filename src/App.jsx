import { useCallback, useEffect, useMemo, useState } from 'react';

const NAV = [
  ['dashboard', 'Overview', 'bx-grid-alt'], ['bins', 'Kiosk Bins', 'bx-trash'],
  ['grinding', 'Grinding Schedule', 'bx-calendar-check'], ['logs', 'Collection Logs', 'bx-list-ul'],
  ['rewards', 'Rewards Desk', 'bx-gift'], ['notifications', 'Notifications', 'bx-bell'],
  ['upcycle', 'Upcycled Output', 'bx-recycle'], ['staff', 'Staff', 'bx-group'],
];
const SIDEBAR_MIN_WIDTH = 76;
const SIDEBAR_MAX_WIDTH = 252;
const SIDEBAR_TABLET_MAX_WIDTH = 220;
const SIDEBAR_COLLAPSED_THRESHOLD = 210;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  return data;
}

function fmt(value, digits = 1) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function when(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function capacityTone(capacity) {
  const percentage = Number(capacity);
  if (percentage <= 40) return 'good';
  if (percentage <= 75) return 'warning';
  return 'alert';
}

function capacityLabel(capacity) {
  return Number(capacity) >= 100 ? 'FULL' : `${capacity}%`;
}

function Badge({ children, tone = '' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Panel({ title, action, children, className = '' }) {
  return <section className={`panel ${className}`}>
    {(title || action) && <div className="panel-head">{title && <h2>{title}</h2>}{action}</div>}
    {children}
  </section>;
}

function LoadingScreen() {
  return <main className="boot-screen" role="status" aria-live="polite">
    <div className="boot-content">
      <div className="boot-mark" aria-hidden="true"><i className="bx bx-recycle" /></div>
      <strong>ECO-TAP</strong>
      <p>Preparing your staff portal…</p>
      <div className="boot-track" aria-hidden="true"><span /></div>
      <a className="boot-retry" href="portal.html">Taking a while? Reload the page</a>
    </div>
  </main>;
}

function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard');
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_MAX_WIDTH);
  const [sidebarMaxWidth, setSidebarMaxWidth] = useState(SIDEBAR_MAX_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [login, setLogin] = useState({ username: 'maria', password: 'eco123' });
  const sidebarCollapsed = sidebarWidth <= SIDEBAR_COLLAPSED_THRESHOLD;

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 720px)');
    const tabletViewport = window.matchMedia('(min-width: 721px) and (max-width: 1050px)');
    const updateSidebarWidth = () => {
      const maxWidth = tabletViewport.matches ? SIDEBAR_TABLET_MAX_WIDTH : SIDEBAR_MAX_WIDTH;
      setSidebarMaxWidth(maxWidth);
      setSidebarWidth((currentWidth) => mobileViewport.matches ? SIDEBAR_MAX_WIDTH : Math.min(currentWidth, maxWidth));
    };
    updateSidebarWidth();
    mobileViewport.addEventListener('change', updateSidebarWidth);
    tabletViewport.addEventListener('change', updateSidebarWidth);
    return () => {
      mobileViewport.removeEventListener('change', updateSidebarWidth);
      tabletViewport.removeEventListener('change', updateSidebarWidth);
    };
  }, []);

  const clampSidebarWidth = (width) => Math.min(sidebarMaxWidth, Math.max(SIDEBAR_MIN_WIDTH, width));
  const handleResizePointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizingSidebar(true);
    setSidebarWidth(clampSidebarWidth(event.clientX));
  };
  const handleResizePointerMove = (event) => {
    if (isResizingSidebar) setSidebarWidth(clampSidebarWidth(event.clientX));
  };
  const handleResizePointerUp = (event) => {
    setIsResizingSidebar(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleResizeKeyDown = (event) => {
    const step = event.shiftKey ? 24 : 10;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setSidebarWidth((width) => clampSidebarWidth(width + (event.key === 'ArrowRight' ? step : -step)));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setSidebarWidth(event.key === 'Home' ? SIDEBAR_MIN_WIDTH : sidebarMaxWidth);
    }
  };

  const refresh = useCallback(async () => {
    const next = await api('/api/bootstrap');
    setData(next);
    setUser(next.user);
    return next;
  }, []);

  useEffect(() => {
    api('/api/bootstrap').then((next) => {
      setData(next); setUser(next.user);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const act = async (operation, successMessage) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await operation();
      await refresh();
      if (successMessage) setNotice(successMessage);
      return true;
    } catch (err) { setError(err.message || 'Something went wrong.'); return false; }
    finally { setBusy(false); }
  };

  const handleLogin = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api('/api/login', { method: 'POST', body: login });
      const next = await api('/api/bootstrap'); setData(next); setUser(next.user || result.user); setView('dashboard');
    } catch (err) { setError(err.message || 'Unable to sign in.'); }
    finally { setBusy(false); setLoading(false); }
  };

  const handleLogout = async () => {
    setBusy(true); setError('');
    try { await api('/api/logout', { method: 'POST' }); setUser(null); setData(null); }
    catch (err) { setError(err.message || 'Unable to sign out.'); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingScreen />;
  if (!user) return <Login login={login} setLogin={setLogin} onSubmit={handleLogin} busy={busy} error={error} />;
  if (!data) return <main className="center-screen"><div className="login-card"><p>Could not load the portal data.</p><button className="button" onClick={() => refresh().catch((err) => setError(err.message))}>Try again</button>{error && <p role="alert">{error}</p>}</div></main>;

  const title = NAV.find(([id]) => id === view)?.[1] || 'Overview';
  const unread = data.notifications?.length || 0;
  const canManage = ['supervisor', 'administrator', 'admin'].includes(String(user.role).toLowerCase());
  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isResizingSidebar ? 'sidebar-resizing' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px` }}>
    <aside className="sidebar">
      <div className="sidebar-header">
        <a className="brand" href="/" aria-label="ECO-TAP home"><span className="brand-mark"><i className="bx bx-recycle" aria-hidden="true" /></span><span>ECO-TAP<small>STAFF PORTAL</small></span></a>
        <button className="sidebar-toggle" type="button" onClick={() => setSidebarWidth(sidebarCollapsed ? sidebarMaxWidth : SIDEBAR_MIN_WIDTH)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed} aria-controls="portal-navigation">
          <i className={`bx ${sidebarCollapsed ? 'bx-chevron-right' : 'bx-chevron-left'}`} aria-hidden="true" />
        </button>
      </div>
      <nav id="portal-navigation" aria-label="Portal sections" className="side-nav">
        {NAV.map(([id, label, icon]) => {
          const accessibleLabel = id === 'notifications' && unread > 0 ? `${label}, ${unread} unread` : label;
          return <button key={id} className={`nav-item ${view === id ? 'selected' : ''}`} onClick={() => { setView(id); setError(''); setNotice(''); }} aria-current={view === id ? 'page' : undefined} aria-label={accessibleLabel} title={accessibleLabel}>
            <i className={`bx ${icon} nav-icon`} aria-hidden="true" /><span className={sidebarCollapsed ? 'sr-only' : undefined}>{label}</span>{id === 'notifications' && unread > 0 && <span className="nav-count">{unread}</span>}
          </button>;
        })}
      </nav>
      <div className="profile">
        <div className="avatar" aria-hidden="true">{user.initials || user.name?.slice(0, 2).toUpperCase()}</div>
        <div className="profile-copy"><strong>{user.name}</strong><span>{user.role}</span></div>
        <button className="icon-button" onClick={handleLogout} disabled={busy} aria-label="Log out"><i className="bx bx-log-out" aria-hidden="true" /></button>
      </div>
      <div className={`sidebar-resizer ${isResizingSidebar ? 'active' : ''}`} role="separator" aria-label="Resize sidebar" aria-orientation="vertical" aria-valuemin={SIDEBAR_MIN_WIDTH} aria-valuemax={sidebarMaxWidth} aria-valuenow={Math.round(sidebarWidth)} aria-valuetext={sidebarCollapsed ? 'Icons only' : `${Math.round(sidebarWidth)} pixels`} tabIndex={0} onPointerDown={handleResizePointerDown} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={handleResizePointerUp} onKeyDown={handleResizeKeyDown} />
    </aside>
    <main className="main-area">
      <header className="topbar"><div><p className="eyebrow">Community recycling operations</p><h1>{title}</h1></div><div className="topbar-user"><span className="online-dot" /> Demo mode <span className="avatar small">{user.initials}</span></div></header>
      <div className="content">
        <div className="notice-stack" aria-live="polite">{error && <div className="feedback error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}{notice && <div className="feedback success">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}</div>
        {busy && <div className="busy-bar" aria-label="Saving changes" />}
        <div className="view-enter" key={view}>
          {view === 'dashboard' && <Dashboard data={data} setView={setView} />}
          {view === 'bins' && <Bins data={data} busy={busy} act={act} canManage={canManage} />}
          {view === 'grinding' && <Grinding data={data} busy={busy} act={act} canManage={canManage} />}
          {view === 'logs' && <Logs data={data} />}
          {view === 'rewards' && <Rewards data={data} busy={busy} act={act} />}
          {view === 'notifications' && <Notifications data={data} />}
          {view === 'upcycle' && <Upcycle data={data} busy={busy} act={act} canManage={canManage} />}
          {view === 'staff' && <Staff data={data} />}
        </div>
        <footer className="page-footer">ECO-TAP local demo · Do not use real resident information</footer>
      </div>
    </main>
  </div>;
}

function Login({ login, setLogin, onSubmit, busy, error }) {
  return <main className="login-screen"><form className="login-card" onSubmit={onSubmit}>
    <a className="brand login-brand" href="/" aria-label="ECO-TAP home"><span className="brand-mark">↻</span><span>ECO-TAP<small>STAFF PORTAL</small></span></a>
    <p className="login-intro">Sign in to explore the staff demo dashboard.</p>
    <label htmlFor="username">Username</label><input id="username" autoComplete="username" required value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
    <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button full" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <div className="demo-credentials"><strong>Demo sign-in</strong><span>maria / eco123</span><span>ana / eco123</span><span>admin / admin</span></div>
    <p className="small-note">Sample accounts only. This local demo is not connected to real users or services.</p>
  </form></main>;
}

function Dashboard({ data, setView }) {
  const stats = data.stats || {};
  const cards = [
    ['Active kiosks', stats.kiosks ?? data.stations?.length ?? 0, 'stations reporting'],
    ['Deposits today', stats.depositsToday ?? data.logs?.length ?? 0, 'sample activity'],
    ['Plastic collected', `${fmt(stats.totalWeight ?? data.logs?.reduce((n, x) => n + Number(x.weight || 0), 0))} kg`, 'in this demo'],
    ['Bins at capacity', stats.fullBins ?? data.stations?.flatMap((s) => Object.values(s.bins || {})).filter((b) => b.capacity >= 100).length ?? 0, 'need collection'],
  ];
  const recent = [...(data.logs || [])].slice(0, 5);
  const bins = data.stations?.flatMap((station) => Object.entries(station.bins || {}).map(([key, bin]) => ({ station, key, bin }))) || [];
  return <div className="overview-view">
    <div className="welcome-row"><div><p className="eyebrow">Welcome back, {data.user?.name || 'team'}</p><h2>Today at a glance</h2><p>Monitor sample collection activity and manage the next steps.</p></div><button className="button secondary" onClick={() => setView('bins')}>View kiosks <span aria-hidden="true">→</span></button></div>
    <div className="stat-grid">{cards.map(([label, value, caption]) => <article className="stat-card data-hover" key={label}><span>{label}</span><strong>{value}</strong><small>{caption}</small></article>)}</div>
    <div className="two-col">
      <Panel title="Kiosk capacity">
        {bins.slice(0, 6).map(({ station, key, bin }) => {
          const tone = capacityTone(bin.capacity);
          const label = capacityLabel(bin.capacity);
          return <div className={`capacity-row data-hover ${tone}`} key={`${station.id}-${key}`}>
            <div className="capacity-copy"><strong>{station.id} · {key.toUpperCase()}</strong><span>{bin.label}</span></div>
            <div className={`capacity-meter ${tone}`} role="progressbar" aria-label={`${station.id} ${key} capacity`} aria-valuenow={bin.capacity} aria-valuemin="0" aria-valuemax="100" aria-valuetext={label}><span style={{ width: `${Math.min(100, bin.capacity)}%` }} /></div>
            <span className={`capacity-value ${tone}`}>{label}</span>
          </div>;
        })}
      </Panel>
      <Panel title="Quick actions"><div className="quick-links">
        {[["grinding", "Schedule grinding", "Plan a collection"], ["rewards", "Redeem rewards", "Process resident points"], ["notifications", "Review alerts", "Check kiosk updates"]].map(([id, label, sub]) => <button key={id} className="quick-link data-hover" onClick={() => setView(id)}><span><strong>{label}</strong><small>{sub}</small></span><span aria-hidden="true">→</span></button>)}
      </div></Panel>
    </div>
    <Panel title="Recent deposits" action={<button className="text-button" onClick={() => setView('logs')}>View logs →</button>}><LogTable logs={recent} /></Panel>
  </div>;
}

function Bins({ data, busy, act, canManage }) {
  const stations = data.stations || [];
  const scan = () => act(() => api('/api/scan-bins', { method: 'POST', body: { scanId: crypto.randomUUID() } }), 'Bin scan complete.');
  return <>
    <div className="section-intro"><div><p className="eyebrow">Collection network</p><h2>Segregation kiosks</h2><p>Sample fill levels refresh when you scan the bins.</p></div>{canManage && <button className="button" disabled={busy} onClick={scan}>{busy ? 'Scanning…' : 'Scan bins now'}</button>}</div>
    {!canManage && <p className="muted">A supervisor or administrator can run a demo bin scan.</p>}
    <div className="station-grid">{stations.map((station) => <Panel key={station.id} className="station-panel" title={<>{station.id}<span className="station-location">{station.location}</span></>} action={<Badge tone="good">{station.status}</Badge>}><div className="bin-list">{Object.entries(station.bins || {}).map(([key, bin]) => { const tone = capacityTone(bin.capacity); return <div className={`bin-row ${tone}`} key={key}><div className="bin-row-head"><div><strong>{key.toUpperCase()} · {bin.grindable ? 'Grindable' : 'Mixed materials'}</strong><small>{bin.label}</small></div><Badge tone={`capacity-${tone}`}>{capacityLabel(bin.capacity)}</Badge></div><div className={`capacity-meter large ${tone}`}><span style={{ width: `${Math.min(100, bin.capacity)}%` }} /></div><div className="bin-meta"><span>{fmt(bin.weight)} kg collected</span><span>{bin.grindable ? bin.grindingStatus : 'Not grindable'}</span></div></div>; })}</div><div className="panel-foot">{station.depositsToday} deposits today <span>Last update: {station.lastSync}</span></div></Panel>)}</div>
  </>;
}

function Grinding({ data, busy, act, canManage }) {
  const [form, setForm] = useState({ station: data.stations?.[0]?.id || '', bins: [], scheduledFor: '', assignedStaff: '', note: '' });
  const sched = data.grindingSchedules || [];
  const grindableBins = data.stations?.find((s) => s.id === form.station)?.bins || {};
  const toggleBin = (id) => setForm((old) => ({ ...old, bins: old.bins.includes(id) ? old.bins.filter((x) => x !== id) : [...old.bins, id] }));
  const submit = async (e) => { e.preventDefault(); if (await act(() => api('/api/grinding-schedules', { method: 'POST', body: form }), 'Grinding schedule added.')) setForm((old) => ({ ...old, bins: [], scheduledFor: '', assignedStaff: '', note: '' })); };
  const update = (id, status) => act(() => api(`/api/grinding-schedules/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } }), `Schedule marked ${status}.`);
  return <>
    <div className="section-intro"><div><p className="eyebrow">Collection planning</p><h2>Grinding schedule</h2><p>Plan work only for grindable kiosk sections.</p></div></div>
    {!canManage && <Panel title="Supervisor access required"><p className="muted">A supervisor or administrator can manage grinding schedules. Sign in with the `ana` or `admin` demo account to continue.</p></Panel>}
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

function Logs({ data }) {
  const [query, setQuery] = useState('');
  const logs = useMemo(() => (data.logs || []).filter((row) => Object.values(row).join(' ').toLowerCase().includes(query.toLowerCase())), [data.logs, query]);
  const total = logs.reduce((n, item) => n + Number(item.weight || 0), 0);
  return <><div className="section-intro"><div><p className="eyebrow">Deposit history</p><h2>Collection logs</h2><p>{logs.length} deposits · {fmt(total)} kg in the current list</p></div><label className="search-field"><span className="sr-only">Search collection logs</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search logs" /></label></div><Panel title="Deposits"><LogTable logs={logs} /></Panel></>;
}

function LogTable({ logs }) {
  if (!logs?.length) return <Empty>No deposits match this view.</Empty>;
  return <div className="table-wrap"><table><thead><tr><th>Resident</th><th>Kiosk</th><th>Section</th><th>Material</th><th>Weight</th><th>Points</th><th>Time</th></tr></thead><tbody>{logs.map((log) => <tr className="log-row" key={log.id}><td>{log.resident}</td><td>{log.kiosk}</td><td>{String(log.section).toUpperCase()}</td><td>{log.material}</td><td>{fmt(log.weight)} kg</td><td>{log.points}</td><td>{when(log.time)}</td></tr>)}</tbody></table></div>;
}

function Rewards({ data, busy, act }) {
  const [residentId, setResidentId] = useState('');
  const [cart, setCart] = useState({});
  const resident = data.residents?.find((r) => r.id === residentId);
  const cost = Object.entries(cart).reduce((sum, [id, qty]) => sum + Number(data.rewardItems?.find((x) => x.id === id)?.cost || 0) * qty, 0);
  const add = (id, delta) => setCart((old) => ({ ...old, [id]: Math.max(0, Number(old[id] || 0) + delta) }));
  const submit = () => act(() => api('/api/redemptions', { method: 'POST', body: { residentId, items: Object.entries(cart).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })), idempotencyKey: crypto.randomUUID() } }), 'Reward redemption recorded.');
  const fulfill = (id) => act(() => api(`/api/redemptions/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'fulfilled' } }), 'Redemption marked fulfilled.');
  return <>
    <div className="section-intro"><div><p className="eyebrow">Resident points desk</p><h2>Rewards</h2><p>Look up a sample resident, select rewards, and record a redemption.</p></div></div>
    <div className="two-col rewards-layout">
      <Panel title="New redemption"><div className="stack-form"><label>Resident<select value={residentId} onChange={(e) => { setResidentId(e.target.value); setCart({}); }}><option value="">Choose resident ID</option>{data.residents?.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}</select></label>
        {resident ? <div className="points-card"><span>{resident.name} · {resident.id}</span><strong>{fmt(resident.points, 0)} points</strong></div> : <p className="muted">Choose a resident to view their available points.</p>}
        <div className="reward-list">{data.rewardItems?.map((item) => <div className="reward-row" key={item.id}><div><strong>{item.name}</strong><small>{item.cost} points</small></div><div className="stepper"><button aria-label={`Remove one ${item.name}`} disabled={!cart[item.id]} onClick={() => add(item.id, -1)}>−</button><span>{cart[item.id] || 0}</span><button aria-label={`Add one ${item.name}`} onClick={() => add(item.id, 1)}>+</button></div></div>)}</div>
        <div className="checkout-row"><span>Total</span><strong>{cost} points</strong></div><button className="button full" disabled={!resident || !cost || cost > Number(resident?.points || 0) || busy} onClick={submit}>Record redemption</button>
      </div></Panel>
      <Panel title="Redemption history"><div className="schedule-list">{data.redemptions?.length ? data.redemptions.map((item) => <article className="schedule-item" key={item.id}><div className="schedule-head"><div><strong>{item.id}</strong><small>{item.resident} · {item.items} · {item.points} points</small></div><Badge tone={item.status === 'fulfilled' ? 'good' : ''}>{item.status}</Badge></div><p>{when(item.time)} · {item.staff}</p>{item.status === 'pending' && <button className="button small" disabled={busy} onClick={() => fulfill(item.id)}>Mark fulfilled</button>}</article>) : <Empty>No redemptions yet.</Empty>}</div></Panel>
    </div>
  </>;
}

function Notifications({ data }) {
  return <><div className="section-intro"><div><p className="eyebrow">Activity and alerts</p><h2>Notifications</h2><p>Updates generated by this local demo.</p></div></div><Panel title="Recent notifications"><div className="schedule-list">{data.notifications?.length ? [...data.notifications].reverse().map((item) => <article className="notification-item" key={item.id}><div className="schedule-head"><div><strong>{item.title}</strong><small>{item.to} · {when(item.time)}</small></div><Badge>{item.type}</Badge></div><p>{item.message}</p></article>) : <Empty>No notifications yet.</Empty>}</div></Panel></>;
}

function Upcycle({ data, busy, act, canManage }) {
  const grindable = data.stations?.flatMap((s) => Object.values(s.bins || {})).filter((b) => b.grindable).reduce((n, b) => n + Number(b.weight || 0), 0) || 0;
  const notify = (target) => act(() => api('/api/upcycle-notifications', { method: 'POST', body: { target } }), `Demo update prepared for ${target}.`);
  return <><div className="section-intro"><div><p className="eyebrow">Material reuse</p><h2>Upcycled output</h2><p>Sample estimates based on currently grindable plastic.</p></div></div><div className="output-summary data-hover"><span>Estimated grindable material</span><strong>{fmt(grindable)} kg</strong></div><div className="output-grid">{data.upcycleYield?.map((item) => <article className="output-card data-hover" key={item.product}><span className="output-icon" aria-hidden="true">{item.icon}</span><h3>{item.product}</h3><p>{item.note}</p><strong>About {fmt(grindable / item.kgPerUnit, 0)} units</strong></article>)}</div><Panel title="Share an estimate"><p className="muted">Creates a sample notification in the local portal. No message is sent outside this demo.</p>{canManage ? <div className="inline-actions"><button className="button" disabled={busy || !grindable} onClick={() => notify('residents')}>Add resident notification</button><button className="button outline" disabled={busy || !grindable} onClick={() => notify('partner')}>Add partner notification</button></div> : <p className="muted">A supervisor or administrator can add a demo notification.</p>}</Panel></>;
}

function Staff({ data }) {
  return <><div className="section-intro"><div><p className="eyebrow">Team directory</p><h2>Staff</h2><p>Sample assignments for the pilot location.</p></div></div><div className="staff-grid">{data.staff?.map((person) => <article className="panel staff-card data-hover" key={person.id}><div className="avatar">{person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><h3>{person.name}</h3><Badge>{person.role}</Badge></div><p>Assigned kiosks</p><strong>{person.assignedKiosks?.join(', ')}</strong><small>{person.contact}</small></article>)}</div></>;
}

function Empty({ children }) { return <p className="empty-state">{children}</p>; }

export default App;

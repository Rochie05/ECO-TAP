import { useCallback, useEffect, useState } from 'react';
import { NAV } from './constants.js';
import { api } from './api.js';
import LoadingScreen from './components/LoadingScreen.jsx';
import Login from './views/Login.jsx';
import Dashboard from './views/Dashboard.jsx';
import Bins from './views/Bins.jsx';
import Logs from './views/Logs.jsx';
import Rewards from './views/Rewards.jsx';
import Notifications from './views/Notifications.jsx';
import Upcycle from './views/Upcycle.jsx';
import Staff from './views/Staff.jsx';
import Accounts from './views/Accounts.jsx';
import Analytics from './views/Analytics.jsx';
import Residents from './views/Residents.jsx';
import Beneficiaries from './views/Beneficiaries.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [login, setLogin] = useState({ username: '', password: '' });

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

  const isSuperadmin = user.role === 'Superadmin';
  const canManageAccounts = isSuperadmin || user.role === 'Administrator';
  const nav = NAV.filter(([id]) => id !== 'accounts' || canManageAccounts);
  const title = nav.find(([id]) => id === view)?.[1] || 'Overview';
  const canEditResidents = ['administrator', 'superadmin'].includes(String(user.role).toLowerCase());
  const unread = data.notifications?.length || 0;
  const canManage = ['supervisor', 'administrator', 'superadmin'].includes(String(user.role).toLowerCase());
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="ECO-TAP home"><span className="brand-mark">↻</span><span>ECO-TAP<small>STAFF PORTAL</small></span></a>
      <nav aria-label="Portal sections" className="side-nav">
        {nav.map(([id, label, icon]) => <button key={id} className={`nav-item ${view === id ? 'selected' : ''}`} onClick={() => { setView(id); setError(''); setNotice(''); }} aria-current={view === id ? 'page' : undefined}>
          <span aria-hidden="true" className="nav-icon">{icon}</span><span>{label}</span>{id === 'notifications' && unread > 0 && <span className="nav-count">{unread}</span>}
        </button>)}
      </nav>
      <div className="profile">
        <div className="avatar" aria-hidden="true">{user.initials || user.name?.slice(0, 2).toUpperCase()}</div>
        <div className="profile-copy"><strong>{user.name}</strong><span>{user.role}</span></div>
        <button className="icon-button" onClick={handleLogout} disabled={busy} aria-label="Log out">↗</button>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><p className="eyebrow">Community recycling operations</p><h1>{title}</h1></div><div className="topbar-user"><span className="online-dot" /> <span className="avatar small">{user.initials}</span></div></header>
      <div className="content">
        <div className="notice-stack" aria-live="polite">{error && <div className="feedback error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}{notice && <div className="feedback success">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}</div>
        {busy && <div className="busy-bar" aria-label="Saving changes" />}
        <div className="view-enter" key={view}>
          {view === 'dashboard' && <Dashboard data={data} setView={setView} />}
          {view === 'analytics' && <Analytics data={data} />}
          {view === 'residents' && <Residents data={data} busy={busy} act={act} canEdit={canEditResidents} />}
          {view === 'beneficiaries' && <Beneficiaries data={data} busy={busy} act={act} canManage={canManage} />}
          {view === 'bins' && <Bins data={data} busy={busy} act={act} canManage={canManage} />}
          {view === 'logs' && <Logs data={data} />}
          {view === 'rewards' && <Rewards data={data} busy={busy} act={act} />}
          {view === 'notifications' && <Notifications data={data} />}
          {view === 'upcycle' && <Upcycle data={data} busy={busy} act={act} canManage={canManage} />}
          {view === 'staff' && <Staff data={data} onManageAccounts={canManageAccounts ? () => setView('accounts') : undefined} />}
          {view === 'accounts' && canManageAccounts && <Accounts data={data} busy={busy} act={act} isSuperadmin={isSuperadmin} />}
        </div>
      </div>
    </main>
  </div>;
}

export default App;

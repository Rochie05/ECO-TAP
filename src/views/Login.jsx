export default function Login({ login, setLogin, onSubmit, busy, error }) {
  return <main className="login-screen"><form className="login-card" onSubmit={onSubmit}>
    <a className="brand login-brand" href="/" aria-label="ECO-TAP home"><span className="brand-mark">↻</span><span>ECO-TAP<small>STAFF PORTAL</small></span></a>
    <p className="login-intro">Sign in to continue to the staff portal.</p>
    <label htmlFor="username">Username</label><input id="username" autoComplete="username" required value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
    <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button full" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form></main>;
}

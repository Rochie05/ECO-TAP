export default function LoadingScreen() {
  return <main className="boot-screen" role="status" aria-live="polite">
    <div className="boot-content">
      <div className="boot-mark" aria-hidden="true">↻</div>
      <strong>ECO-TAP</strong>
      <p>Preparing your staff portal…</p>
      <div className="boot-track" aria-hidden="true"><span /></div>
      <a className="boot-retry" href="portal.html">Taking a while? Reload the page</a>
    </div>
  </main>;
}

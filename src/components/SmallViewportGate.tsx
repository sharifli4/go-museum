export function SmallViewportGate() {
  return (
    <div className="gate">
      <div className="gate-inner">
        <div className="wordmark">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7.5" fill="none" stroke="#d9d6cf" strokeWidth="1.2" />
            <circle cx="10" cy="10" r="2.2" fill="#00ADD8" />
            <path d="M10 0.5v4M10 15.5v4M0.5 10h4M15.5 10h4" stroke="#7d828a" strokeWidth="1" />
          </svg>
          Go Museum
        </div>
        <h1>Best on a laptop or desktop.</h1>
        <p>This tour is drawn for a window at least 1280×800. Widen the window to walk through it.</p>
      </div>
    </div>
  );
}

// Full-screen overlay shown only in portrait orientation. This is the reliable,
// cross-platform (incl. iOS Safari) way to keep this landscape-only tablet app
// in landscape. Visibility is driven entirely by CSS (@media orientation) in
// globals.css, so it works without JS.
export default function OrientationGate() {
  return (
    <div className="orientation-gate" role="alert" aria-live="polite">
      <div className="orientation-gate__inner">
        <div className="orientation-gate__icon" aria-hidden>
          📱
        </div>
        <p className="orientation-gate__title">가로로 돌려주세요</p>
        <p className="orientation-gate__sub">이 앱은 가로 화면에서 가장 잘 보여요</p>
      </div>
    </div>
  );
}

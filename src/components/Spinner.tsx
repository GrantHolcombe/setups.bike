// The app's loading spinner: a green "radio waves" icon (a dot and two arcs fading in one after
// another). Drawn as a plain SVG so the app doesn't need react-loader-spinner, which pulled in
// a second styling library (styled-components) just for this.
export const SPINNER_COLOR = '#4fa94d';

const wave = (begin: string) => (
  <animate attributeName='stroke-opacity' calcMode='linear' values='0;1;1' keyTimes='0;0.2;1'
    dur='1s' begin={begin} repeatCount='indefinite' />
);

export default function Spinner({ size = 48, label = 'Loading' }: { size?: number; label?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox='0 0 100 100' role='img' aria-label={label}>
        <circle cx='28' cy='75' r='11' fill={SPINNER_COLOR}>
          <animate attributeName='fill-opacity' calcMode='linear' values='0;1;1' keyTimes='0;0.2;1'
            dur='1s' begin='0s' repeatCount='indefinite' />
        </circle>
        <path d='M28 47A28 28 0 0 1 56 75' fill='none' strokeWidth='10' stroke={SPINNER_COLOR}>{wave('0.1s')}</path>
        <path d='M28 25A50 50 0 0 1 78 75' fill='none' strokeWidth='10' stroke={SPINNER_COLOR}>{wave('0.2s')}</path>
      </svg>
    </div>
  );
}

// Full-screen dimmed overlay with the spinner, shown while the app is busy.
export function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div role='status' aria-live='polite' style={{
      position: 'fixed', inset: 0, zIndex: 1400, background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Spinner size={80} />
    </div>
  );
}

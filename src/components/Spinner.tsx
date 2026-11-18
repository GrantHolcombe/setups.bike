import { Radio } from 'react-loader-spinner';

// The app's loading spinner (the same green Radio as the full-screen overlay), for inline use.
export const SPINNER_COLORS: [string, string, string] = ['#4fa94d', '#4fa94d', '#4fa94d'];

export default function Spinner({ size = 48 }: { size?: number }) {
  return (
    <Radio visible height={`${size}px`} width={`${size}px`} colors={SPINNER_COLORS}
      ariaLabel='radio-loading' wrapperStyle={{ display: 'flex', justifyContent: 'center' }} />
  );
}

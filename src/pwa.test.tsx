import { render, screen, fireEvent, act } from '@testing-library/react';
import { useInstallOption, promptInstall, isIOS } from './pwa';
import InstallHelpDialog from './components/Header/AppMenu/InstallHelpDialog';

const setUA = (ua: string, touch = 0) => {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: touch, configurable: true });
};
const setStandalone = (on: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes('standalone'), media: q, addEventListener() {}, removeEventListener() {} })) as any;
};

function Probe() {
  return <span data-testid='opt'>{String(useInstallOption())}</span>;
}

afterEach(() => { setUA('Mozilla/5.0 (Windows NT 10.0) Chrome/120'); setStandalone(false); });

test('iPhone Safari gets Add to Home Screen steps', () => {
  setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1');
  setStandalone(false);
  render(<Probe />);
  expect(screen.getByTestId('opt').textContent).toBe('ios');
});

test('iPad (reports as a Mac with touch) counts as iOS', () => {
  setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 5);
  expect(isIOS()).toBe(true);
});

test('nothing is offered once the app is installed', () => {
  setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
  setStandalone(true);
  render(<Probe />);
  expect(screen.getByTestId('opt').textContent).toBe('null');
});

test('desktop Chrome offers Install App once the browser allows it, and uses its prompt', async () => {
  setStandalone(false);
  render(<Probe />);
  expect(screen.getByTestId('opt').textContent).toBe('null');
  const event: any = new Event('beforeinstallprompt');
  event.prompt = jest.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  act(() => { window.dispatchEvent(event); });
  expect(screen.getByTestId('opt').textContent).toBe('prompt');
  let installed = false;
  await act(async () => { installed = await promptInstall(); });
  expect(event.prompt).toHaveBeenCalled();
  expect(installed).toBe(true);
  expect(screen.getByTestId('opt').textContent).toBe('null');
});

test('the iOS help explains Share > Add to Home Screen', () => {
  const onClose = jest.fn();
  render(<InstallHelpDialog open onClose={onClose} />);
  expect(screen.getByText('Add to Home Screen')).toBeTruthy();
  fireEvent.click(screen.getByText('Got it'));
  expect(onClose).toHaveBeenCalled();
});

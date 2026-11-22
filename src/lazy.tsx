import * as React from 'react';

// Code that isn't needed to show the garage: dialogs and Pro features. Each loads as its own
// chunk, so the first screen downloads and runs less JavaScript. Once a signed-in garage is
// showing, preloadParts() fetches them in the background, so opening one doesn't wait.
const parts = {
  AddBikeModal: () => import('./components/Header/AppMenu/AddBikeModal'),
  DeleteBikeModal: () => import('./components/Header/AppMenu/DeleteBikeModal'),
  ReorderGarageModal: () => import('./components/Header/AppMenu/ReorderGarageModal'),
  InstallHelpDialog: () => import('./components/Header/AppMenu/InstallHelpDialog'),
  EmailPrefsDialog: () => import('./components/Header/AppMenu/EmailPrefsDialog'),
  DeleteAccountDialog: () => import('./components/Header/AppMenu/DeleteAccountDialog'),
  EmailPrompt: () => import('./components/EmailPrompt'),
  SignInDialog: () => import('./components/SignIn/SignInDialog'),
  NameDialog: () => import('./components/SignIn/NameDialog'),
  UpgradeDialog: () => import('./components/Billing/UpgradeDialog'),
  RideNotes: () => import('./components/BikeCard/RideNotes'),
  ShareDialog: () => import('./components/BikeCard/ShareDialog'),
  SharedSetupView: () => import('./components/Shared/SharedSetupView'),
};

export const AddBikeModal = React.lazy(parts.AddBikeModal);
export const DeleteBikeModal = React.lazy(parts.DeleteBikeModal);
export const ReorderGarageModal = React.lazy(parts.ReorderGarageModal);
export const InstallHelpDialog = React.lazy(parts.InstallHelpDialog);
export const EmailPrefsDialog = React.lazy(parts.EmailPrefsDialog);
export const DeleteAccountDialog = React.lazy(parts.DeleteAccountDialog);
export const EmailPrompt = React.lazy(parts.EmailPrompt);
export const SignInDialog = React.lazy(parts.SignInDialog);
export const NameDialog = React.lazy(parts.NameDialog);
export const UpgradeDialog = React.lazy(parts.UpgradeDialog);
export const RideLogDialog = React.lazy(() => parts.RideNotes().then((m) => ({ default: m.RideLogDialog })));
export const RideHistoryDialog = React.lazy(() => parts.RideNotes().then((m) => ({ default: m.RideHistoryDialog })));
export const ShareDialog = React.lazy(parts.ShareDialog);
export const SharedSetupView = React.lazy(parts.SharedSetupView);

let preloaded = false;
// Fetches every chunk when the browser is idle. Safe to call more than once.
export function preloadParts() {
  if (preloaded) return;
  preloaded = true;
  const run = () => Object.values(parts).forEach((load) => load().catch(() => { preloaded = false; }));
  const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: object) => void) | undefined;
  if (idle) idle(run, { timeout: 3000 }); else setTimeout(run, 1500);
}

// Mounts a lazy dialog the first time it opens, and keeps it mounted afterwards so its close
// animation still plays. Until then nothing renders and nothing is downloaded.
export function WhenOpened({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [opened, setOpened] = React.useState(open);
  React.useEffect(() => { if (open) setOpened(true); }, [open]);
  if (!opened && !open) return null;
  return <React.Suspense fallback={null}>{children}</React.Suspense>;
}

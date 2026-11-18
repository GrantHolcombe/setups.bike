import { Settings } from '../../rides';

// Read-only view of a bike's 18 settings, for ride notes and shared setups.
// Compression and rebound show only the adjusters the bike uses (None / Single / Dual).
const adjusters = (s: Settings, prefix: string, kind: 'C' | 'R') => {
  const count = Math.min(2, Math.max(0, Number((s as any)[`${prefix}count`]) || 0));
  if (count === 0) return null;
  const parts = [`LS${kind} ${Number((s as any)[`${prefix}1`]) || 0}`];
  if (count === 2) parts.push(`HS${kind} ${Number((s as any)[`${prefix}2`]) || 0}`);
  return parts.join(' · ');
};

function End({ s, end }: { s: Settings; end: 'front' | 'rear' }) {
  const rows: [string, string | number | null][] = [
    ['Tire', s[`${end}_tire`] ?? 0],
    [end === 'front' ? 'Fork' : 'Shock', s[`${end}_sus_pressure`] ?? 0],
    ['Compression', adjusters(s, `${end}_sus_comp_`, 'C')],
    ['Rebound', adjusters(s, `${end}_sus_rebound_`, 'R')],
    ['Tokens', s[`${end}_tokens`] ?? 0],
  ];
  return (
    <div className='settingsSummaryEnd'>
      <div className='settingsSummaryTitle'>{end === 'front' ? 'Front' : 'Rear'}</div>
      {rows.filter(([, v]) => v !== null).map(([label, v]) => (
        <div key={label} className='settingsSummaryRow'><span>{label}</span><strong>{v}</strong></div>
      ))}
    </div>
  );
}

export default function SettingsSummary({ settings }: { settings: Settings }) {
  return (
    <div className='settingsSummary'>
      <End s={settings} end='front' />
      <End s={settings} end='rear' />
    </div>
  );
}

import * as React from 'react';

interface ISettingInputProps {
  name: string;
  // for a <label htmlFor>
  id?: string;
  value: number | null | undefined;
  //called as the user types (valid whole numbers only), so the card updates live
  onChange: (name: string, value: number) => void;
  //called on blur with the final value, to save it
  onCommit: (name: string, value: number) => void;
  className?: string;
  // outlines the field in red (its last save failed)
  invalid?: boolean;
}

//digits only, at most 5 of them (no real setting gets near 99,999)
const clean = (raw: string) => raw.replace(/[^0-9]/g, '').slice(0, 5);

// A whole-number setting input that:
//  - never goes below 0 (no minus sign, and the arrow keys and spinner stop at 0)
//  - empties a 0 when you click in, so you can just type
//  - puts the last value back if you leave it empty
export default function SettingInput({ id, name, value, onChange, onCommit, className = 'componentInput', invalid = false }: ISettingInputProps) {
  const current = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const [text, setText] = React.useState<string>(String(current));
  const focused = React.useRef(false);

  //follow outside changes (a reloaded garage, an applied setup) while not being edited
  React.useEffect(() => {
    if (!focused.current) setText(String(current));
  }, [current]);

  return (
    <input
      type='number'
      inputMode='numeric'
      min={0}
      max={99999}
      step={1}
      className={invalid ? `${className} saveFailed` : className}
      aria-invalid={invalid || undefined}
      id={id}
      name={name}
      value={text}
      onFocus={() => {
        focused.current = true;
        if (text === '0') setText('');
      }}
      onKeyDown={(e) => {
        //minus, plus, decimals and exponents aren't valid settings
        if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
        if (e.key === 'ArrowDown' && Number(text || 0) <= 0) e.preventDefault();
      }}
      onChange={(e) => {
        const raw = clean(e.target.value);
        setText(raw);
        if (raw !== '') onChange(name, Math.max(0, parseInt(raw, 10)));
      }}
      onBlur={() => {
        focused.current = false;
        const next = text === '' ? current : Math.max(0, parseInt(text, 10));
        setText(String(next));
        onChange(name, next);
        onCommit(name, next);
      }}
    />
  );
}

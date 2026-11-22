import * as React from 'react';
import { Box, OutlinedInput } from '@mui/material';

interface ICodeInputProps {
  length?: number;
  disabled?: boolean;
  // every change, as the digits typed so far (gaps dropped)
  onChange: (code: string) => void;
  // all boxes filled
  onComplete?: (code: string) => void;
}

// One box per digit. Pasting (or a phone's "from Messages/Mail" suggestion) anywhere fills them
// all; typing moves to the next box; Backspace on an empty box goes back. Reset it by giving the
// component a new key.
export default function CodeInput({ length = 6, disabled, onChange, onComplete }: ICodeInputProps) {
  const [digits, setDigits] = React.useState<string[]>(() => Array(length).fill(''));
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    if (el) { el.focus(); el.select(); }
  };

  React.useEffect(() => { focus(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: string[]) => {
    setDigits(next);
    const code = next.join('');
    onChange(code);
    if (code.length === length && onComplete) onComplete(code);
  };

  // Put a run of digits in starting at box i (a paste, autofill, or one typed digit).
  const fill = (i: number, text: string) => {
    const incoming = text.replace(/\D/g, '');
    if (!incoming) return;
    // a whole code always starts at the first box, wherever it was pasted
    const start = incoming.length >= length ? 0 : i;
    const next = [...digits];
    incoming.slice(0, length - start).split('').forEach((d, k) => { next[start + k] = d; });
    update(next);
    focus(Math.min(start + incoming.length, length - 1));
  };

  const onKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) { next[i] = ''; update(next); } else if (i > 0) { next[i - 1] = ''; update(next); focus(i - 1); }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1); }
  };

  return (
    <Box role='group' aria-label='Code' sx={{
      display: 'grid', gridTemplateColumns: `repeat(${length}, 1fr)`, gap: 1, maxWidth: 336, mx: 'auto',
    }}>
      {digits.map((d, i) => (
        <OutlinedInput
          key={i}
          value={d}
          disabled={disabled}
          inputRef={(el) => { refs.current[i] = el; }}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') { const next = [...digits]; next[i] = ''; update(next); return; }
            // typed over an existing digit: keep only the new character
            fill(i, v.length > 1 && d && v.includes(d) ? v.replace(d, '') || v : v);
          }}
          onPaste={(e) => { e.preventDefault(); fill(i, e.clipboardData.getData('text')); }}
          onKeyDown={onKeyDown(i)}
          onFocus={(e) => e.target.select()}
          inputProps={{
            inputMode: 'numeric',
            pattern: '[0-9]*',
            autoComplete: i === 0 ? 'one-time-code' : 'off',
            'aria-label': `Digit ${i + 1} of ${length}`,
            style: { textAlign: 'center', fontSize: '1.5rem', padding: '12px 0' },
          }}
        />
      ))}
    </Box>
  );
}

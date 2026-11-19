import './TokenInput.css';

interface ITokenInputProps {
  count: number | null | undefined;
  // called only when the rider clicks + or -
  onChange: (count: number) => void;
  // outlines the counter in red (its last save failed)
  invalid?: boolean;
}

const MAX_TOKENS = 12;

// Volume token counter. Controlled by the bike's value, so it follows applied setups, and it
// only reports a change when a button is clicked (never on load).
export default function TokenInput({ count, onChange, invalid = false }: ITokenInputProps) {
  const coins = Math.min(MAX_TOKENS, Math.max(0, Number(count) || 0));

  return (
  <div style={{display: "flex", width:"100%"}}>
    <div className='tokenRelContainer'>
        <div className='tokenContainer'>
        {Array(coins).fill(0).map((e,i) => {
            return <img src="/img/fox_token.png" key={i} className='coinShadow' style={{left: (i * 10) +"px", top: (i + 1) +"px", height: "55px", width: "55px",transform: "rotate(-3deg)"}} alt="logo" />
        })}
        </div>
    </div>

    <div className={invalid ? 'controls saveFailed' : 'controls'} role='group' aria-label='Token count'>
        <button aria-label='Remove a token' disabled={coins === 0} onClick={() => onChange(Math.max(0, coins - 1))}>-</button>
        <p className='tokenLabel'>Token Count ({coins})</p>
        <button aria-label='Add a token' disabled={coins === MAX_TOKENS} onClick={() => onChange(Math.min(MAX_TOKENS, coins + 1))}>+</button>
    </div>
  </div>
  );
}

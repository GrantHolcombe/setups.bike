import * as React from 'react';
import './TokenInput.css';
export default function TokenInput() {
    const [coins, setCoins] = React.useState<number>(4);
    React.useEffect(() => {
      let emptyArray = Array(coins).fill(0)

    }, [coins])
  return (
  <div style={{display: "flex", width:"100%"}}>
    <div className='tokenRelContainer'>
        <div className='tokenContainer'>
        {Array(coins).fill(0).map((e,i) => {
            return <img src="/img/fox_token.png" key={i} className='coinShadow' style={{left: (i * 10) +"px", top: (i + 1) +"px", height: "55px", width: "55px",transform: "rotate(-3deg)"}} alt="logo" />
        })}
        </div>
    </div>
  
    <div className='controls'>
        <button onClick={() => setCoins(Math.max(0, coins - 1))}>-</button>
        <p className='tokenLabel'>Token Count ({coins})</p>
        <button onClick={() => setCoins(Math.min(12, coins + 1))}>+</button>
    </div>
  </div>
  );
}
import { ImageResponse } from 'next/og';
export const alt = 'Stellar Chill Café — Brew something. Put it on-chain. Share a little joy.';
export const size = {width:1200,height:630};
export const contentType = 'image/png';
export const dynamic = 'force-static';
export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{display:'flex',width:'100%',height:'100%',background:'#302b27',color:'#f3ead6',padding:'62px 70px',fontFamily:'sans-serif',position:'relative'}}>
      <div style={{display:'flex',flexDirection:'column',width:720}}>
        <div style={{display:'flex',fontSize:19,letterSpacing:5,color:'#c7ae87'}}>A LITTLE COFFEE. A LITTLE COSMOS.</div>
        <div style={{display:'flex',fontSize:76,fontWeight:700,lineHeight:1.08,marginTop:38,letterSpacing:-3}}>Stellar Chill Café</div>
        <div style={{display:'flex',flexDirection:'column',fontSize:40,lineHeight:1.35,marginTop:30,color:'#e0d3bd'}}><span>Brew something.</span><span>Put it on-chain.</span><span>Share a little joy.</span></div>
        <div style={{display:'flex',fontSize:18,letterSpacing:3,marginTop:'auto',color:'#c7ae87'}}>CREATE · DISCOVER · ORDER</div>
      </div>
      <div style={{display:'flex',position:'absolute',right:42,top:125,width:350,height:350,borderRadius:175,background:'#3c3631',alignItems:'center',justifyContent:'center'}}>
        <svg width="320" height="320" viewBox="0 0 64 64"><path d="M20 17q-4-4 0-8m9 10q-4-5 0-10" fill="none" stroke="#c7ae87" strokeWidth="2" strokeLinecap="round"/><path d="M15 28h31v8c0 12-5 17-15 17S15 48 15 36z" fill="#f0e5ce"/><path d="M46 30h4c10 0 9 16-4 15" fill="none" stroke="#f0e5ce" strokeWidth="4"/><ellipse cx="30.5" cy="28" rx="15.5" ry="5" fill="#b38a63"/><ellipse cx="30.5" cy="28" rx="11" ry="2.6" fill="#584039"/><path d="M48 8l2.3 5.7L56 16l-5.7 2.3L48 24l-2.3-5.7L40 16l5.7-2.3z" fill="#b4a2c5"/><path d="M14 56h34" stroke="#c7ae87" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      <div style={{display:'flex',position:'absolute',right:80,bottom:62,fontSize:16,letterSpacing:3,color:'#b4a2c5'}}>STELLAR TESTNET · NO REAL FUNDS</div>
    </div>, size);
}

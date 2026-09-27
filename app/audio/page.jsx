"use client";
import {useState} from "react";
import Sidebar from "../components/Sidebar";

export default function AudioPage(){
 const [text,setText]=useState(""); const [voice,setVoice]=useState(""); const [rate,setRate]=useState(1); const [speaking,setSpeaking]=useState(false); const [mobileNav,setMobileNav]=useState(false);
 function speak(){ if(!text.trim()||typeof window==="undefined") return; speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=Number(rate); if(voice){const v=speechSynthesis.getVoices().find(x=>x.name===voice);if(v)u.voice=v;} u.onstart=()=>setSpeaking(true);u.onend=()=>setSpeaking(false);speechSynthesis.speak(u);}
 function stop(){speechSynthesis.cancel();setSpeaking(false);}
 const voices=typeof window!=="undefined"?speechSynthesis.getVoices():[];
 return <main className="shell"><button className="mobileMenu" onClick={()=>setMobileNav(true)}>☰</button>{mobileNav&&<div className="navBackdrop" onClick={()=>setMobileNav(false)}/>}<Sidebar mobileOpen={mobileNav} onNavigate={()=>setMobileNav(false)}/><section className="content">
 <header><div><label>CREATE · VOICE</label><h1>AI Audio</h1><span>Write narration, preview the voice and prepare audio for your video.</span></div><a className="upgrade" href="/">Dashboard</a></header>
 <div className="audioWorkspace">
  <section className="panel"><label>SCRIPT</label><h2>Voiceover</h2><textarea className="largeInput" value={text} onChange={e=>setText(e.target.value)} placeholder="Paste or write the narration for your YouTube video..."/><div className="controlRow"><label>Voice<select value={voice} onChange={e=>setVoice(e.target.value)}><option value="">Default voice</option>{voices.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}</select></label><label>Speed<select value={rate} onChange={e=>setRate(e.target.value)}><option value="0.8">0.8×</option><option value="1">1×</option><option value="1.2">1.2×</option></select></label></div><div className="actionRow"><button className="primary" onClick={speaking?stop:speak} disabled={!text.trim()}>{speaking?"Stop preview":"▶ Preview voice"}</button><small>{text.length} characters</small></div></section>
  <section className="panel audioPreview"><label>PREVIEW</label><div className="wave"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><strong>{speaking?"Playing narration":"Ready for preview"}</strong><p>Browser voice preview is available now. Production audio export can use the configured server-side provider.</p></section>
 </div></section></main>
}
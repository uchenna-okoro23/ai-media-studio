"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function VideoPage() {
  const [prompt,setPrompt]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [output,setOutput]=useState(null);
  const [mobileNav,setMobileNav]=useState(false);

  async function generate(){
    if(!prompt.trim()){setNotice("Enter a prompt first.");return;}
    setBusy(true);setNotice("");setOutput(null);
    try{
      const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"AI Video",prompt})});
      const data=await r.json().catch(()=>({}));
      if(r.ok&&data.url){setOutput(data.url);setNotice("Video generation completed.");}
      else setNotice(data.error||"Video generation could not be completed.");
    }catch{setNotice("Could not reach the generation service.");}
    finally{setBusy(false);}
  }

  return <main className="shell">
    <button className="mobileMenu" onClick={()=>setMobileNav(true)} aria-label="Open navigation">☰</button>
    {mobileNav&&<div className="navBackdrop" onClick={()=>setMobileNav(false)}/>}
    <Sidebar mobileOpen={mobileNav} onNavigate={()=>setMobileNav(false)}/>
    <section className="content">
      <header><div><label>CREATE · AI VIDEO</label><h1>AI Video Generator</h1><span>Create short-form video from a text prompt.</span></div><a className="upgrade" href="/">Dashboard</a></header>
      <div className="workspace">
        <div className="panel"><label>VIDEO PROMPT</label><h2>Describe your video</h2><textarea maxLength={2000} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="A cinematic drone shot flying over a futuristic city at sunset..."/><div className="foot"><small>{prompt.length}/2000</small><button onClick={generate} disabled={busy}>{busy?"Generating...":"✦ Generate video"}</button></div>{notice&&<div className="notice">{notice}</div>}</div>
        <div className="panel"><label>OUTPUT</label><h2>Preview</h2><div className="preview">{output?<a className="outputLink" href={output} target="_blank" rel="noreferrer">Open generated video</a>:<><b>✦</b><strong>Your video will appear here</strong><small>Video generation uses the configured server-side provider.</small></>}</div></div>
      </div>
      <footer>AI Media Studio · <a href="/">Dashboard</a></footer>
    </section>
  </main>;
}

"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function ScenesPage() {
  const [prompt,setPrompt]=useState("");
  const [mobileNav,setMobileNav]=useState(false);

  return <main className="shell">
    <button className="mobileMenu" onClick={()=>setMobileNav(true)}>☰</button>
    {mobileNav&&<div className="navBackdrop" onClick={()=>setMobileNav(false)}/>}
    <Sidebar mobileOpen={mobileNav} onNavigate={()=>setMobileNav(false)}/>
    <section className="content">
      <header><div><label>CREATE</label><h1>Scene Generator</h1><span>Turn a story idea into a visual scene.</span></div><a className="upgrade" href="/">Dashboard</a></header>
      <div className="panel"><label>SCENE</label><h2>Describe your scene</h2><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe the characters, location, mood, lighting and camera..."/><div className="foot"><small>{prompt.length}/2000</small><button>✦ Generate scene</button></div></div>
    </section>
  </main>;
}

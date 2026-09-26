"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function StoryboardPage() {
  const [prompt,setPrompt]=useState("");
  const [mobileNav,setMobileNav]=useState(false);

  return <main className="shell">
    <button className="mobileMenu" onClick={()=>setMobileNav(true)}>☰</button>
    {mobileNav&&<div className="navBackdrop" onClick={()=>setMobileNav(false)}/>}
    <Sidebar mobileOpen={mobileNav} onNavigate={()=>setMobileNav(false)}/>
    <section className="content">
      <header><div><label>CREATE</label><h1>Storyboard</h1><span>Plan scenes, shots and narrative beats.</span></div><a className="upgrade" href="/">Dashboard</a></header>
      <div className="panel"><label>STORYBOARD FRAME</label><h2>Describe the shot</h2><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Scene 1: describe the subject, action, camera angle, lighting, mood and visual style..."/><div className="foot"><small>{prompt.length}/2000</small><button>✦ Generate frame</button></div></div>
      <div className="cards">
        <div className="card"><strong>Scene 1</strong><small>{prompt||"Add your first storyboard scene."}</small></div>
        <div className="card"><strong>Scene 2</strong><small>Next scene placeholder</small></div>
        <div className="card"><strong>Scene 3</strong><small>Next scene placeholder</small></div>
      </div>
    </section>
  </main>;
}

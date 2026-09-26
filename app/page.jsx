"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "./components/Sidebar";

const tools = [
  ["AI Image","/image","Create polished images from text prompts.","IMAGE"],
  ["AI Video","/video","Turn ideas into short-form video.","VIDEO"],
  ["Scene Generator","/scenes","Develop complete visual scenes.","SCENE"],
  ["Storyboard","/storyboard","Plan shots and narrative beats.","STORY"],
  ["AI Editor","/editor","Refine and assemble your media.","EDIT"],
];

export default function Home() {
  const [user,setUser]=useState(null);
  const [mobileNav,setMobileNav]=useState(false);
  const [showAuth,setShowAuth]=useState(false);
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [projectCount,setProjectCount]=useState(0);

  useEffect(()=>{load();},[]);

  async function load(){
    try{
      const me=await fetch("/api/auth/me").then(r=>r.json());
      setUser(me.user||null);
      if(!me.user)return;
      const h=await fetch("/api/generations").then(r=>r.json());
      setProjectCount((h.generations||[]).length);
    }catch{}
  }

  async function auth(e){
    e.preventDefault();
    setBusy(true);setNotice("");
    try{
      const r=await fetch("/api/auth/"+mode,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email:email.trim().toLowerCase(),password})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok){setNotice(data.error||"Account request failed.");return;}
      setShowAuth(false);setEmail("");setPassword("");await load();
    }catch{setNotice("Account service did not respond.");}
    finally{setBusy(false);}
  }

  function openAuth(nextMode){
    setMode(nextMode);
    setNotice("");
    setShowAuth(true);
  }

  return <main className="shell">
    <button className="mobileMenu" onClick={()=>setMobileNav(true)} aria-label="Open navigation">☰</button>
    {mobileNav&&<div className="navBackdrop" onClick={()=>setMobileNav(false)}/>}
    <Sidebar mobileOpen={mobileNav} onNavigate={()=>setMobileNav(false)}/>

    <section className="content">
      <header>
        <div>
          <label>HOME · DASHBOARD</label>
          <h1>Creative command center.</h1>
          <span>Generate, edit and organize your AI media from one workspace.</span>
        </div>
        {!user&&<div className="authActions">
          <button className="upgrade" onClick={()=>openAuth("login")}>Sign in</button>
          <button className="upgrade" onClick={()=>openAuth("register")}>Create account</button>
        </div>}
      </header>

      <div className="balanceHero">
        <div>
          <label>ACCOUNT BALANCE</label>
          <div className="balance">$0.00</div>
          <small>Available funds for paid AI services</small>
        </div>
        <Link className="primaryAction" href="/settings">Fund account</Link>
      </div>

      <div className="statGrid">
        <div className="statCard">
          <span>PLAN</span>
          <strong>Free</strong>
          <small>Starter workspace</small>
        </div>
        <div className="statCard">
          <span>PROJECTS</span>
          <strong>{projectCount}</strong>
          <small>Saved generations</small>
        </div>
        <div className="statCard">
          <span>MEDIA TOOLS</span>
          <strong>5</strong>
          <small>Available in your studio</small>
        </div>
        <div className="statCard">
          <span>WORKSPACE</span>
          <strong>Ready</strong>
          <small>Start a new project</small>
        </div>
      </div>

      <div className="sectionHeading">
        <div>
          <label>CREATE</label>
          <h2>Choose a tool</h2>
        </div>
        <span>Start with an idea and build from there.</span>
      </div>

      <div className="cards">
        {tools.map(([name,href,desc,tag])=><Link className="card" href={href} key={href}>
          <span className="toolTag">{tag}</span>
          <strong>{name}</strong>
          <small>{desc}</small>
          <b>Open tool →</b>
        </Link>)}
      </div>

      <div className="workspace">
        <div className="panel">
          <label>QUICK START</label>
          <h2>Create your first visual</h2>
          <p>Describe an idea, generate the media, then continue refining it in the AI Editor.</p>
          <Link className="outputLink" href="/image">Start with AI Image</Link>
        </div>
        <div className="panel">
          <label>YOUR WORKSPACE</label>
          <h2>Everything in one place</h2>
          <p>Use the sidebar to move between creation tools, your editor and account settings without leaving the studio.</p>
          <Link className="outputLink" href="/editor">Open AI Editor</Link>
        </div>
      </div>

      <footer>AI Media Studio · <a href="/api/health">System status</a> · <Link href="/settings">Settings</Link></footer>
    </section>

    {showAuth&&<div className="modal" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setShowAuth(false)}}>
      <form className="auth" onSubmit={auth}>
        <button type="button" className="viewerClose" onClick={()=>!busy&&setShowAuth(false)}>×</button>
        <label>{mode==="login"?"WELCOME BACK":"CREATE ACCOUNT"}</label>
        <h2>{mode==="login"?"Sign in to AI Media Studio":"Create your account"}</h2>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" required/>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" minLength={mode==="register"?8:undefined} required/>
        {notice&&<div className="notice">{notice}</div>}
        <button className="authBtn" disabled={busy}>{busy?"Please wait...":mode==="login"?"Sign in":"Create account"}</button>
        <button type="button" className="googleButton" onClick={()=>{window.location.href="/api/auth/google"}} disabled={busy}>Continue with Google</button>
        <div className="authSwitch">{mode==="login"?<><span>Don't have an account?</span><button type="button" onClick={()=>{setMode("register");setNotice("")}}>Create account</button></>:<><span>Already have an account?</span><button type="button" onClick={()=>{setMode("login");setNotice("")}}>Sign in</button></>}</div>
      </form>
    </div>}
  </main>;
}

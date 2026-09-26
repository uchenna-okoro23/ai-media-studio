"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "./components/Sidebar";

const tools = [
  ["AI Image","/image","Create realistic images from prompts."],
  ["AI Video","/video","Generate short-form video."],
  ["Scene Generator","/scenes","Build structured visual scenes."],
  ["Storyboard","/storyboard","Plan shots and narrative beats."],
];

export default function Home() {
  const [user,setUser]=useState(null);
  const [usage,setUsage]=useState({today:0,dailyLimit:10});
  const [history,setHistory]=useState([]);
  const [mobileNav,setMobileNav]=useState(false);
  const [showAuth,setShowAuth]=useState(false);
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{load();},[]);

  async function load(){
    try{
      const me=await fetch("/api/auth/me").then(r=>r.json());
      setUser(me.user||null);
      if(!me.user)return;
      const [a,h]=await Promise.all([
        fetch("/api/account").then(r=>r.json()),
        fetch("/api/generations").then(r=>r.json())
      ]);
      if(a.usage)setUsage(a.usage);
      if(h.generations)setHistory(h.generations);
    }catch{}
  }

  async function auth(e){
    e.preventDefault();
    setBusy(true);setNotice("");
    try{
      const r=await fetch("/api/auth/"+mode,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase(),password})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok){setNotice(data.error||"Account request failed.");return;}
      setShowAuth(false);setEmail("");setPassword("");await load();
    }catch{setNotice("Account service did not respond.");}
    finally{setBusy(false);}
  }

  return <main className="shell">
    <button className="mobileMenu" onClick={()=>setMobileNav(true)}>☰</button>
    {mobileNav&&<div className="navBackdrop" onClick={()=>setMobileNav(false)}/>}
    <Sidebar mobileOpen={mobileNav} onNavigate={()=>setMobileNav(false)}/>
    <section className="content">
      <header>
        <div><label>HOME · DASHBOARD</label><h1>Welcome to AI Media Studio.</h1><span>Choose a creative tool and build your next piece of media.</span></div>
        {user?<div className="accountChip">{user.email}</div>:<div className="authActions"><button className="upgrade" onClick={()=>{setMode("login");setShowAuth(true)}}>Sign in</button><button className="upgrade" onClick={()=>{setMode("register");setShowAuth(true)}}>Create account</button></div>}
      </header>

      <div className="cards">{tools.map(([name,href,desc])=><Link className="card" href={href} key={href}><strong>{name}</strong><small>{desc}</small></Link>)}<Link className="card" href="/editor"><strong>AI Editor</strong><small>Trim, preview and refine media in your browser.</small></Link></div>

      <div className="workspace">
        <div className="panel">
          <label>DAILY USAGE</label><h2>Your generation allowance</h2>
          <strong>{usage.today} / {usage.dailyLimit} generations used today</strong>
          <div className="usage" style={{marginTop:14}}><div><i style={{width:Math.min(100,(usage.today/usage.dailyLimit)*100)+"%"}}/></div><small>Limit resets daily.</small></div>
        </div>
        <div className="panel">
          <label>QUICK START</label><h2>Start creating</h2>
          <p>Open AI Image for the working image-generation interface, or choose another tool from the sidebar.</p>
          <Link className="outputLink" href="/image">Open AI Image</Link>
        </div>
      </div>

      <div className="panel history">
        <label>RECENT</label><h2>Recent creations</h2>
        {history.length===0?<p>No creations yet. Choose a tool above to get started.</p>:history.slice(0,8).map(item=><div className="item" key={item.id}><b>{item.prompt}</b><small>{item.type} · {new Date(item.created_at).toLocaleString()} · {item.status}</small></div>)}
      </div>

      <footer>AI Media Studio · <a href="/api/health">API health</a></footer>
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

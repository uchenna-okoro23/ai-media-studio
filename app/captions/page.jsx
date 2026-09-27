"use client";
import {useMemo,useState} from "react";
import Sidebar from "../components/Sidebar";

export default function CaptionsPage(){
 const [video,setVideo]=useState(null);const [text,setText]=useState("");const [segments,setSegments]=useState([{start:"00:00",end:"00:05",text:"Your first caption goes here."},{start:"00:05",end:"00:10",text:"Edit the words and timings for your video."}]);const [mobileNav,setMobileNav]=useState(false);
 const preview=useMemo(()=>video?URL.createObjectURL(video):"",[video]);
 function update(i,key,value){setSegments(s=>s.map((x,n)=>n===i?{...x,[key]:value}:x));}
 function add(){setSegments(s=>[...s,{start:"00:10",end:"00:15",text:"New caption"}]);}
 return <main className="shell"><button className="mobileMenu" onClick={()=>setMobileNav(true)}>☰</button>{mobileNav&&<div className="navBackdrop" onClick={()=>setMobileNav(false)}/>}<Sidebar mobileOpen={mobileNav} onNavigate={()=>setMobileNav(false)}/><section className="content">
 <header><div><label>PRODUCTION · CAPTIONS</label><h1>Caption Studio</h1><span>Load a video, edit caption text and control timing before export.</span></div><a className="upgrade" href="/">Dashboard</a></header>
 <div className="captionStudio">
  <section className="panel captionPreview">{preview?<video src={preview} controls/>:<div className="uploadEmpty"><strong>Drop your video here</strong><small>MP4, WebM or MOV</small><label className="uploadButton">Choose video<input type="file" accept="video/*" onChange={e=>setVideo(e.target.files?.[0]||null)}/></label></div>}</section>
  <section className="panel"><label>CAPTION TRACK</label><div className="captionToolbar"><button onClick={add}>+ Add caption</button><span>{segments.length} segments</span></div>{segments.map((s,i)=><div className="captionRow" key={i}><input value={s.start} onChange={e=>update(i,"start",e.target.value)}/><input value={s.end} onChange={e=>update(i,"end",e.target.value)}/><input value={s.text} onChange={e=>update(i,"text",e.target.value)}/></div>)}<div className="exportBar"><input value={text} onChange={e=>setText(e.target.value)} placeholder="Caption style name"/><button className="primary">Export captions</button></div></section>
 </div></section></main>
}
"use client";
import {useEffect,useRef,useState} from "react";
import Sidebar from "../components/Sidebar";

export default function AudioPage(){
  const [text,setText]=useState(""); const [voice,setVoice]=useState(""); const [rate,setRate]=useState(1); const [speaking,setSpeaking]=useState(false);
  const [mobileNav,setMobileNav]=useState(false); const [browserVoices,setBrowserVoices]=useState([]); const [clonedVoices,setClonedVoices]=useState([]); const [freeVoices,setFreeVoices]=useState([]);
  const [providerConfigured,setProviderConfigured]=useState(true); const [name,setName]=useState(""); const [files,setFiles]=useState([]); const [consent,setConsent]=useState(false);
  const [cloneBusy,setCloneBusy]=useState(false); const [generateBusy,setGenerateBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [audioUrl,setAudioUrl]=useState(""); const [savedVoiceovers,setSavedVoiceovers]=useState([]); const audioRef=useRef(null);

  useEffect(()=>{
    const load=()=>setBrowserVoices(window.speechSynthesis.getVoices()); load(); window.speechSynthesis.onvoiceschanged=load;
    fetch("/api/voices").then(r=>r.ok?r.json():null).then(d=>d&&setClonedVoices(d.voices||[])).catch(()=>{});
    fetch("/api/audio/voices").then(r=>r.ok?r.json():null).then(d=>{if(d){setFreeVoices(d.voices||[]);setProviderConfigured(d.providerConfigured!==false)}}).catch(()=>{});
    fetch("/api/generations").then(r=>r.ok?r.json():null).then(d=>{if(d)setSavedVoiceovers((d.generations||[]).filter(g=>g.type==="AI Audio"&&g.status==="completed"))}).catch(()=>{});
    return ()=>{window.speechSynthesis.onvoiceschanged=null;window.speechSynthesis.cancel()};
  },[]);

  function speak(){
    if(!text.trim())return; window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text.trim()); u.rate=Number(rate); u.lang="en-US";
    const v=browserVoices.find(x=>/^en(-|_)/i.test(x.lang))||browserVoices.find(x=>/english|en-us|en-gb|google|microsoft/i.test(x.name)); if(v)u.voice=v;
    u.onstart=()=>setSpeaking(true); u.onend=()=>setSpeaking(false); u.onerror=()=>setSpeaking(false); window.speechSynthesis.speak(u);
  }
  function stop(){window.speechSynthesis.cancel();setSpeaking(false)}

  async function cloneVoice(){
    setError("");setMessage(""); if(!name.trim())return setError("Enter a name for the voice."); if(!files.length)return setError("Upload at least one audio sample."); if(!consent)return setError("Confirm that you own the voice or have permission to use it.");
    setCloneBusy(true); try{
      const form=new FormData(); form.append("name",name.trim()); form.append("consent","true"); files.forEach(file=>form.append("files",file,file.name));
      const res=await fetch("/api/voices/clone",{method:"POST",body:form}); const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(typeof data.error==="string"?data.error:"Voice cloning failed.");
      setClonedVoices(v=>[data.voice,...v]); setVoice(data.voice.id); setName("");setFiles([]);setConsent(false); const input=document.getElementById("voiceFiles");if(input)input.value="";setMessage("Voice clone is ready.");
    }catch(e){setError(e.message||"Voice cloning failed.")}finally{setCloneBusy(false)}
  }

  async function generateVoiceover(){
    setError("");setMessage(""); if(!text.trim())return setError("Write or paste your narration first.");
    if(!voice||(!freeVoices.some(v=>v.id===voice)&&!clonedVoices.some(v=>v.id===voice)))return setError("Select a production voice first.");
    setGenerateBusy(true); try{
      const res=await fetch("/api/audio/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,voiceId:voice})});
      const data=await res.json().catch(()=>({})); if(!res.ok)throw new Error(data.error||"Audio generation failed.");
      setAudioUrl(data.url); setSavedVoiceovers(items=>[{id:data.id,type:"AI Audio",prompt:text,status:"completed",created_at:new Date().toISOString()},...items.filter(item=>item.id!==data.id)]);
      setMessage(`Voiceover generated and saved. ${data.usage?.remaining??"—"} daily generations remaining.`);
    }catch(e){setError(e.message||"Audio generation failed.")}finally{setGenerateBusy(false)}
  }

  return <main className="shell"><button className="mobileMenu" onClick={()=>setMobileNav(true)}>☰</button>{mobileNav&&<div className="navBackdrop" onClick={()=>setMobileNav(false)}/>}<Sidebar mobileOpen={mobileNav} onNavigate={()=>setMobileNav(false)}/><section className="content">
    <header><div><label>CREATE · VOICE</label><h1>AI Audio</h1><span>Generate YouTube narration with available production voices, or use your own clone when your plan supports cloning.</span></div><a className="upgrade" href="/">Dashboard</a></header>
    {(error||message)&&<div className={error?"notice error":"notice"}>{error||message}</div>}
    <div className="audioWorkspace"><section className="panel"><label>SCRIPT</label><h2>Voiceover</h2><textarea className="largeInput" value={text} onChange={e=>setText(e.target.value)} placeholder="Paste or write the narration for your YouTube video..."/>
      <div className="controlRow"><label>Production voice<select value={voice} onChange={e=>{stop();setVoice(e.target.value)}}><option value="">Select a voice</option>{freeVoices.map(v=><option key={v.id} value={v.id}>{v.name} · Free</option>)}{clonedVoices.length>0&&<option disabled>— Your clones —</option>}{clonedVoices.map(v=><option key={v.id} value={v.id}>{v.name} · Clone</option>)}</select></label><label>Test speed<select value={rate} onChange={e=>setRate(e.target.value)}><option value="0.8">0.8×</option><option value="1">1×</option><option value="1.2">1.2×</option></select></label></div>
      <div className="actionRow"><button className="primary" onClick={speaking?stop:speak} disabled={!text.trim()||!voice}>{speaking?"Stop text test":"▶ Test my text"}</button><button className="secondary" onClick={generateVoiceover} disabled={generateBusy||!text.trim()||!voice}>{generateBusy?"Generating…":"Generate production voiceover"}</button><small>{text.length} characters · Text test reads only the text in the script box using your device speech engine. It does not generate audio or use your daily limit.</small></div>
      {audioUrl&&<div style={{marginTop:18}}><label>GENERATED AUDIO</label><audio ref={audioRef} controls src={audioUrl} style={{width:"100%",marginTop:8}}/></div>}
      <div className="audioPreview" style={{marginTop:24}}><label>SAVED VOICEOVERS</label><h3>Your generated previews</h3>{savedVoiceovers.length===0?<p>No generated voiceovers saved yet.</p>:<div>{savedVoiceovers.slice(0,8).map(item=><div className="voiceRow" key={item.id} style={{display:"block",padding:"14px 0"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><strong>{new Date(item.created_at).toLocaleString()}</strong><span>{item.prompt?.length||0} characters</span></div><p style={{margin:"8px 0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.prompt}</p><audio controls preload="none" src={`/api/generations/${item.id}/media`} style={{width:"100%"}}/></div>)}</div>}</div>
    </section><section className="panel"><label>AVAILABLE VOICES</label><h2>Generate with production voices</h2><p>Choose a production voice, test your script without using a generation, then generate only when you are satisfied.</p><div className="voiceGrid">{freeVoices.length===0?<p>Loading available voices…</p>:freeVoices.map(v=><button type="button" className={voice===v.id?"voiceCard selected":"voiceCard"} key={v.id} onClick={()=>{stop();setVoice(v.id)}}><strong>{v.name}</strong><span>{v.description||"Premade narration voice"}</span></button>)}</div>{!providerConfigured&&<small>Voice provider is not configured on the server. Browser text testing is still available.</small>}
      <div className="cloneBox"><label>YOUR VOICE CLONE</label><h3>Clone your own voice</h3><p>Upload a clean recording. For best results, use about 1–2 minutes of clear audio from one speaker with minimal background noise.</p><input className="textInput" value={name} onChange={e=>setName(e.target.value)} placeholder="Voice name"/><input id="voiceFiles" className="textInput" type="file" accept="audio/*" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))}/>{files.length>0&&<small>{files.length} sample{files.length===1?"":"s"} selected</small>}<label className="checkRow"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I own this voice or have permission to use and clone it.</span></label><button className="primary" onClick={cloneVoice} disabled={cloneBusy}>{cloneBusy?"Cloning voice…":"Clone my voice"}</button></div>
    </section></div></section></main>
}
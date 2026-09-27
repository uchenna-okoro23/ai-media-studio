"use client";
import {useEffect, useRef, useState} from "react";
import Sidebar from "../components/Sidebar";

export default function AudioPage(){
  const [text,setText]=useState("");
  const [voice,setVoice]=useState("");
  const [rate,setRate]=useState(1);
  const [speaking,setSpeaking]=useState(false);
  const [mobileNav,setMobileNav]=useState(false);
  const [browserVoices,setBrowserVoices]=useState([]);
  const [clonedVoices,setClonedVoices]=useState([]);
  const [freeVoices,setFreeVoices]=useState([]);
  const [providerConfigured,setProviderConfigured]=useState(true);
  const [name,setName]=useState("");
  const [files,setFiles]=useState([]);
  const [consent,setConsent]=useState(false);
  const [cloneBusy,setCloneBusy]=useState(false);
  const [generateBusy,setGenerateBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [audioUrl,setAudioUrl]=useState("");
  const audioRef=useRef(null);

  useEffect(()=>{
    const load=()=>setBrowserVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged=load;
    fetch("/api/voices").then(r=>r.ok?r.json():null).then(d=>d&&setClonedVoices(d.voices||[])).catch(()=>{});
    fetch("/api/audio/voices").then(r=>r.ok?r.json():null).then(d=>{if(d){setFreeVoices(d.voices||[]);setProviderConfigured(d.providerConfigured!==false);}}).catch(()=>{});
    return ()=>{window.speechSynthesis.onvoiceschanged=null;};
  },[]);

  function speak(){
    if(!text.trim()) return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.rate=Number(rate);
    const v=browserVoices.find(x=>x.name===voice);
    if(v) u.voice=v;
    u.onstart=()=>setSpeaking(true);
    u.onend=()=>setSpeaking(false);
    u.onerror=()=>setSpeaking(false);
    window.speechSynthesis.speak(u);
  }
  function stop(){window.speechSynthesis.cancel();setSpeaking(false);}

  async function cloneVoice(){
    setError("");setMessage("");
    if(!name.trim()){setError("Enter a name for the voice.");return;}
    if(!files.length){setError("Upload at least one audio sample.");return;}
    if(!consent){setError("Confirm that you own the voice or have permission to use it.");return;}
    setCloneBusy(true);
    try{
      const form=new FormData();
      form.append("name",name.trim());
      form.append("consent","true");
      files.forEach(file=>form.append("files",file,file.name));
      const res=await fetch("/api/voices/clone",{method:"POST",body:form});
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(typeof data.error==="string"?data.error:"Voice cloning failed. Please check the uploaded audio and try again.");
      setClonedVoices(v=>[data.voice,...v]);
      setVoice(data.voice.id);
      setName("");setFiles([]);setConsent(false);
      const input=document.getElementById("voiceFiles"); if(input) input.value="";
      setMessage("Voice clone is ready.");
    }catch(e){setError(e.message||"Voice cloning failed.");}
    finally{setCloneBusy(false);}
  }

  async function generateVoiceover(){
    setError("");setMessage("");
    if(!text.trim()){setError("Write or paste your narration first.");return;}
    if(!voice || !freeVoices.some(v=>v.id===voice) && !clonedVoices.some(v=>v.id===voice)){setError("Select a production voice first.");return;}
    setGenerateBusy(true);
    try{
      const res=await fetch("/api/audio/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,voiceId:voice})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||"Audio generation failed.");
      setAudioUrl(data.url);
      setMessage(`Voiceover generated. ${data.usage?.remaining ?? "—"} daily generations remaining.`);
    }catch(e){setError(e.message||"Audio generation failed.");}
    finally{setGenerateBusy(false);}
  }

  const selectedCloned=clonedVoices.find(v=>v.id===voice);

  return <main className="shell">
    <button className="mobileMenu" onClick={()=>setMobileNav(true)}>☰</button>
    {mobileNav&&<div className="navBackdrop" onClick={()=>setMobileNav(false)}/>}
    <Sidebar mobileOpen={mobileNav} onNavigate={()=>setMobileNav(false)}/>
    <section className="content">
      <header>
        <div><label>CREATE · VOICE</label><h1>AI Audio</h1><span>Generate YouTube narration with free premade voices, or use your own clone when your ElevenLabs plan supports cloning.</span></div>
        <a className="upgrade" href="/">Dashboard</a>
      </header>

      {(error||message)&&<div className={error?"notice error":"notice"}>{error||message}</div>}

      <div className="audioWorkspace">
        <section className="panel">
          <label>SCRIPT</label><h2>Voiceover</h2>
          <textarea className="largeInput" value={text} onChange={e=>setText(e.target.value)} placeholder="Paste or write the narration for your YouTube video..."/>
          <div className="controlRow">
            <label>Production voice
              <select value={voice} onChange={e=>setVoice(e.target.value)}>
                <option value="">Select cloned voice</option>
                {clonedVoices.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label>Browser preview
              <select value={rate} onChange={e=>setRate(e.target.value)}>
                <option value="0.8">0.8×</option><option value="1">1×</option><option value="1.2">1.2×</option>
              </select>
            </label>
          </div>
          <div className="actionRow">
            <button className="primary" onClick={speaking?stop:speak} disabled={!text.trim()}>{speaking?"Stop preview":"▶ Browser preview"}</button>
            <button className="secondary" onClick={generateVoiceover} disabled={generateBusy||!text.trim()||!voice}>{generateBusy?"Generating…":"Generate production voiceover"}</button>
            <small>{text.length} characters</small>
          </div>
          {audioUrl&&<div style={{marginTop:18}}><label>GENERATED AUDIO</label><audio ref={audioRef} controls src={audioUrl} style={{width:"100%",marginTop:8}}/></div>}
        </section>

        <section className="panel">
          <label>VOICE LAB</label><h2>Clone a voice</h2>
          <p>Upload a clean recording. ElevenLabs recommends about 1–2 minutes of clear audio for Instant Voice Cloning. Keep the recording to one speaker with minimal background noise.</p>
          <input className="textInput" value={name} onChange={e=>setName(e.target.value)} placeholder="Voice name"/>
          <input id="voiceFiles" className="textInput" type="file" accept="audio/*" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))}/>
          {files.length>0&&<small>{files.length} sample{files.length===1?"":"s"} selected · {Math.round(files.reduce((n,f)=>n+f.size,0)/1024/1024*10)/10} MB</small>}
          <label className="checkRow"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I own this voice or have permission to use and clone it.</span></label>
          <button className="primary" onClick={cloneVoice} disabled={cloneBusy}>{cloneBusy?"Cloning voice…":"Clone my voice"}</button>
          <div className="audioPreview">
            <label>MY VOICES</label>
            {clonedVoices.length===0?<p>No cloned voices saved yet.</p>:
              <div>{clonedVoices.map(v=><div className="voiceRow" key={v.id}><strong>{v.name}</strong><span>{v.status}</span><button className="secondary" onClick={()=>setVoice(v.id)}>Use voice</button></div>)}</div>}
          </div>
        </section>
      </div>
    </section>
  </main>
}

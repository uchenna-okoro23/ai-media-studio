"use client";
import {useEffect,useState} from "react";

export default function Settings(){
 const [account,setAccount]=useState(null),[wallet,setWallet]=useState(null),[amount,setAmount]=useState("5000"),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);

 useEffect(()=>{
   load();
   const p=new URLSearchParams(location.search).get("payment");
   if(p==="success")setMessage("Payment successful. Your AI Media Studio wallet has been funded.");
   else if(p==="failed")setMessage("Payment was not completed.");
   else if(p==="error")setMessage("Payment verification failed. Contact support before trying again.");
 },[]);

 async function load(){
   const [a,w]=await Promise.all([fetch("/api/account"),fetch("/api/wallet")]);
   setAccount(await a.json());
   setWallet(await w.json());
 }

 async function fund(){
   setBusy(true);setMessage("");
   try{
     const r=await fetch("/api/payments/paystack",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount})});
     const d=await r.json();
     if(!r.ok){setMessage(d.error||"Could not start payment.");return}
     location.href=d.authorization_url;
   }catch{setMessage("Payment service did not respond.")}finally{setBusy(false)}
 }

 async function logout(){
   const r=await fetch("/api/auth/logout",{method:"POST"});
   if(r.ok)location.href="/";
 }

 const prices=account?.wallet?.pricing;
 return <main className="editorShell">
  <header className="editorHeader"><div><label>ACCOUNT</label><h1>Settings & Billing</h1><span>Manage your profile, wallet and AI service usage.</span></div><a href="/">Back to Studio</a></header>
  <section className="editorGrid">
   <div className="editorPanel">
    <label>AI MEDIA STUDIO WALLET</label>
    <h2>₦{Number(account?.balance||0).toLocaleString("en-NG",{minimumFractionDigits:2})}</h2>
    <p>Your Studio wallet is used for AI services after the daily free allowance. One payment here can fund usage across connected AI providers.</p>
    <input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9]/g,""))} inputMode="numeric" placeholder="Amount in NGN"/>
    <button className="primary" onClick={fund} disabled={busy}>{busy?"Opening secure checkout...":"Fund AI wallet"}</button>
    {message&&<p>{message}</p>}
    <p>Payments are processed by Paystack; card and bank details are entered on Paystack's checkout and are not stored by this application.</p>
   </div>

   <div className="editorPanel">
    <label>AI SERVICE PRICING</label>
    <p>First {account?.wallet?.freeDailyGenerations||10} generations each day use the free allowance.</p>
    <p>AI Image: ₦{prices?.image ?? 1}</p>
    <p>AI Video: ₦{prices?.video ?? 15}</p>
    <p>Scene Generator: ₦{prices?.scene ?? 1}</p>
    <p>Storyboard: ₦{prices?.storyboard ?? 1}</p>
    <p>Prices are configurable by the application owner and should be aligned with the actual provider costs before public launch.</p>
   </div>

   <div className="editorPanel">
    <label>PROFILE</label>
    {account?.user?<><h2>{account.user.email}</h2><p>Created: {new Date(account.user.created_at).toLocaleString()}</p><button className="primary" onClick={logout}>Sign out</button></>:<p>{account?.error||"Loading account..."}</p>}
   </div>

   <div className="editorPanel">
    <label>PLAN & USAGE</label>
    {account?.usage?<><h2>Free allowance</h2><p>{account.usage.today} / {account.usage.dailyLimit} free generations used today.</p><p>{Math.max(0,account.usage.dailyLimit-account.usage.today)} free generations remaining.</p><p>{account.usage.total} total generations saved.</p></>:<p>Loading usage...</p>}
   </div>

   <div className="editorPanel">
    <label>WALLET HISTORY</label>
    {wallet?.transactions?.length?<div>{wallet.transactions.slice(0,10).map(t=><p key={t.id}>{new Date(t.created_at).toLocaleString()} — {t.type} — {t.amount>=0?"+":"-"}₦{Math.abs(t.amount).toLocaleString("en-NG",{minimumFractionDigits:2})} — {t.status}</p>)}</div>:<p>No wallet transactions yet.</p>}
   </div>
  </section>
 </main>
}
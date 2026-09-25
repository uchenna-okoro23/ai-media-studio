"use client";
import {useEffect,useState} from "react";
export default function Settings(){
 const [account,setAccount]=useState(null),[message,setMessage]=useState("");
 useEffect(()=>{fetch("/api/account").then(r=>r.json()).then(setAccount)},[]);
 async function logout(){const r=await fetch("/api/auth/logout",{method:"POST"});if(r.ok){setMessage("Signed out.");setTimeout(()=>location.href="/",400);}}
 return <main className="editorShell"><header className="editorHeader"><div><label>ACCOUNT</label><h1>Settings</h1><span>Manage your account and free usage.</span></div><a href="/">Back to Studio</a></header><section className="editorGrid"><div className="editorPanel"><label>PROFILE</label>{account?.user?<><h2>{account.user.email}</h2><p>Account ID: {account.user.id}</p><p>Created: {new Date(account.user.created_at).toLocaleString()}</p><button className="primary" onClick={logout}>Sign out</button></>:<p>{account?.error||"Loading account..."}</p>}</div><div className="editorPanel"><label>USAGE</label>{account?.usage?<><h2>{account.usage.today} / {account.usage.dailyLimit} generations today</h2><p>{account.usage.dailyLimit-account.usage.today} free generations remaining today.</p><p>{account.usage.total} total generations saved to your PostgreSQL history.</p></>:<p>Loading usage...</p>}{message&&<p>{message}</p>}</div></section></main>
}
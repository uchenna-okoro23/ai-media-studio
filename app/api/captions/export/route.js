import {getSessionUser} from "@/lib/auth";
export async function POST(req){
 const u=await getSessionUser(); if(!u)return Response.json({error:"Authentication required."},{status:401});
 const b=await req.json().catch(()=>null); if(!b?.segments?.length)return Response.json({error:"Caption segments are required."},{status:400});
 const fmt=b.format==="vtt"?"vtt":"srt";
 const clean=t=>String(t||"").replace(/\r?\n/g," ").trim();
 const stamp=v=>{const p=String(v||"00:00").split(":").map(Number);let sec=p.length===2?p[0]*60+p[1]:p[p.length-1];if(!Number.isFinite(sec))sec=0;const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=Math.floor(sec%60),ms=Math.round((sec-Math.floor(sec))*1000);const hh=String(h).padStart(2,"0"),mm=String(m).padStart(2,"0"),ss=String(s).padStart(2,"0"),mmm=String(ms).padStart(3,"0");return hh+":"+mm+":"+ss+(fmt==="vtt"?"."+mmm:","+mmm)};
 const body=(fmt==="vtt"?"WEBVTT\n\n":"")+b.segments.map((s,i)=>(fmt==="srt"?(i+1)+"\n":"")+stamp(s.start)+" --> "+stamp(s.end)+"\n"+clean(s.text)).join("\n\n")+"\n";
 return new Response(body,{headers:{"Content-Type":fmt==="vtt"?"text/vtt":"application/x-subrip","Content-Disposition":"attachment; filename=\"captions."+fmt+"\""}});
}
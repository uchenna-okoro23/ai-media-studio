const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const VIDRUSH_API_BASE = process.env.VIDRUSH_API_BASE || "https://vidrush-ai.com/api/v1";

function hasVidrush() { return Boolean(process.env.VIDRUSH_API_KEY); }
function hasReplicate() { return Boolean(process.env.REPLICATE_API_TOKEN); }

export function providerStatus(){
 return {
  image:hasReplicate(),
  video:hasVidrush() || hasReplicate(),
  vidrush:hasVidrush(),
  replicate:hasReplicate()
 };
}

async function parseJson(response){
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
  const detail=data?.error?.message||data?.detail||data?.error||data?.message;
  const error=new Error(typeof detail==="string"?detail:"AI provider request failed.");
  error.status=response.status;
  error.code=data?.code;
  throw error;
 }
 if(data?.code !== undefined && data.code !== 0){
  const error=new Error(data.message||"AI provider request failed.");
  error.status=response.status;
  error.code=data.code;
  throw error;
 }
 return data;
}

async function pollReplicatePrediction(data,token){
 if(["succeeded","failed","canceled"].includes(data?.status)) return data;
 const getUrl=data?.urls?.get||(data?.id?REPLICATE_API_BASE+"/predictions/"+data.id:null);
 if(!getUrl) throw new Error("Video provider returned no prediction URL.");
 for(let i=0;i<120;i++){
  await new Promise(resolve=>setTimeout(resolve,2000));
  const response=await fetch(getUrl,{headers:{Authorization:"Bearer "+token}});
  const current=await parseJson(response);
  if(["succeeded","failed","canceled"].includes(current?.status)) return current;
 }
 throw new Error("Video generation timed out.");
}

async function pollVidrushTask(taskId,token){
 const interval=Math.max(2,Number(process.env.VIDRUSH_POLL_SECONDS||5))*1000;
 const maxPolls=Math.max(12,Number(process.env.VIDRUSH_MAX_POLLS||120));
 for(let i=0;i<maxPolls;i++){
  const response=await fetch(VIDRUSH_API_BASE+"/tasks/"+encodeURIComponent(taskId),{
   headers:{Authorization:"Bearer "+token},
   cache:"no-store"
  });
  const data=await parseJson(response);
  const task=data?.data||{};
  if(task.status==="success"){
   const url=Array.isArray(task.taskUrls)?task.taskUrls.find(Boolean):null;
   if(!url) throw new Error("Vidrush finished without a usable video URL.");
   return {status:"completed",url,costCredits:task.costCredits};
  }
  if(task.status==="failed"||task.status==="canceled"){
   throw new Error(task.error||task.message||("Vidrush task ended with status: "+task.status));
  }
  await new Promise(resolve=>setTimeout(resolve,interval));
 }
 throw new Error("Vidrush video generation timed out.");
}

async function quoteVidrushVideo(body,token){
 const response=await fetch(VIDRUSH_API_BASE+"/videos/quote",{
  method:"POST",
  headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
  body:JSON.stringify(body)
 });
 return await parseJson(response);
}

async function generateVideoWithVidrush({prompt,imageUrl,model,duration,resolution,aspectRatio}){
 const token=process.env.VIDRUSH_API_KEY;
 if(!token) throw new Error("Vidrush is not configured.");
 const requestBody={
  model:model||process.env.VIDRUSH_VIDEO_MODEL||"vidrush-v1",
  mode:imageUrl?"image-to-video":"text-to-video",
  prompt,
  ...(imageUrl?{image_urls:[imageUrl]}:{}),
  options:{
   duration:duration||process.env.VIDRUSH_VIDEO_DURATION||"8s",
   resolution:resolution||process.env.VIDRUSH_VIDEO_RESOLUTION||"720p",
   aspect_ratio:aspectRatio||process.env.VIDRUSH_VIDEO_ASPECT_RATIO||"16:9"
  }
 };
 const quote=await quoteVidrushVideo(requestBody,token);
 const quotedCost=Number(quote?.data?.costCredits);
 console.info("AI Video: Vidrush quote",{model:requestBody.model,mode:requestBody.mode,duration:requestBody.options.duration,resolution:requestBody.options.resolution,costCredits:Number.isFinite(quotedCost)?quotedCost:null});
 const response=await fetch(VIDRUSH_API_BASE+"/videos",{
  method:"POST",
  headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
  body:JSON.stringify(requestBody)
 });
 const data=await parseJson(response);
 const taskId=data?.data?.id;
 if(!taskId) throw new Error("Vidrush returned no task id.");
 const result=await pollVidrushTask(taskId,token);
 return {status:"completed",type:"AI Video",prompt,url:result.url,mime:"video/mp4",provider:"vidrush",providerTaskId:taskId,costCredits:Number.isFinite(quotedCost)?quotedCost:null};
}

async function generateVideoWithReplicate(prompt){
 const token=process.env.REPLICATE_API_TOKEN;
 if(!token) throw new Error("Replicate video service is not configured.");
 const input={
  prompt,
  num_frames:Number(process.env.VIDEO_FRAMES||81),
  aspect_ratio:process.env.VIDEO_ASPECT_RATIO||"16:9",
  resolution:process.env.VIDEO_RESOLUTION||"480p",
  frames_per_second:Number(process.env.VIDEO_FPS||16),
  go_fast:true,
  sample_shift:Number(process.env.VIDEO_SAMPLE_SHIFT||12),
  interpolate_output:true
 };
 console.info("AI Video: Replicate Wan 2.2 T2V Fast",{model:"wan-video/wan-2.2-t2v-fast",frames:input.num_frames,resolution:input.resolution,aspectRatio:input.aspect_ratio});
 const response=await fetch(REPLICATE_API_BASE+"/models/wan-video/wan-2.2-t2v-fast/predictions",{
  method:"POST",
  headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,Prefer:"wait"},
  body:JSON.stringify({input})
 });
 let data=await parseJson(response);
 data=await pollReplicatePrediction(data,token);
 if(data.status!=="succeeded") throw new Error(data.error||"Video generation ended with status: "+(data.status||"unknown"));
 const output=Array.isArray(data.output)?data.output[0]:data.output;
 const url=typeof output==="string"?output:output?.url||null;
 if(!url) throw new Error("Video provider returned no video URL.");
 return {status:"completed",type:"AI Video",prompt,url,mime:"video/mp4",provider:"replicate"};
}

async function generateVideoAutomatically(args){
 const providers=[];
 const configuredOrder=String(process.env.VIDEO_PROVIDER||"auto").toLowerCase();
 if(configuredOrder==="vidrush"&&hasVidrush()) providers.push("vidrush");
 else if(configuredOrder==="replicate"&&hasReplicate()) providers.push("replicate");
 else if(configuredOrder==="auto"){
  if(hasVidrush()) providers.push("vidrush");
  if(hasReplicate()) providers.push("replicate");
 } else {
  if(hasVidrush()) providers.push("vidrush");
  if(hasReplicate()) providers.push("replicate");
 }
 const fallback=String(process.env.VIDEO_PROVIDER_FALLBACK||"").toLowerCase();
 if(fallback==="vidrush"&&hasVidrush()&&!providers.includes("vidrush")) providers.push("vidrush");
 if(fallback==="replicate"&&hasReplicate()&&!providers.includes("replicate")) providers.push("replicate");
 if(!providers.length) throw new Error("No video provider is configured. Add a Vidrush or Replicate API key.");
 const errors=[];
 for(const provider of providers){
  try{
   console.info("AI Video: trying provider",provider);
   if(provider==="vidrush") return await generateVideoWithVidrush(args);
   return await generateVideoWithReplicate(args.prompt);
  }catch(error){
   const message=error?.message||String(error);
   errors.push(provider+": "+message);
   console.error("AI Video provider failed",{provider,message,status:error?.status});
   if(error?.status===402 && provider==="replicate") continue;
  }
 }
 throw new Error(errors.join(" | "));
}

export async function generateMedia({type,prompt,imageUrl,model,duration,resolution,aspectRatio}){
 if(!prompt?.trim()) throw new Error("Prompt is required.");
 if(type==="AI Image"&&hasReplicate()){
  const response=await fetch(REPLICATE_API_BASE+"/models/black-forest-labs/flux-2-pro/predictions",{
   method:"POST",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.REPLICATE_API_TOKEN,Prefer:"wait"},
   body:JSON.stringify({input:{
    prompt,
    aspect_ratio:process.env.IMAGE_ASPECT_RATIO||"1:1",
    resolution:process.env.IMAGE_RESOLUTION||"1 MP",
    output_format:process.env.IMAGE_OUTPUT_FORMAT||"webp",
    output_quality:Number(process.env.IMAGE_OUTPUT_QUALITY||90),
    safety_tolerance:Number(process.env.IMAGE_SAFETY_TOLERANCE||2)
   }})
  });
  let data=await parseJson(response);
  if(!["succeeded","failed","canceled"].includes(data.status)) data=await pollReplicatePrediction(data,process.env.REPLICATE_API_TOKEN);
  if(data.status!=="succeeded") throw new Error(data.error||"Image generation did not complete.");
  const output=Array.isArray(data.output)?data.output[0]:data.output;
  const url=typeof output==="string"?output:output?.url||null;
  if(!url) throw new Error("Image provider returned no image URL.");
  return {status:"completed",type,prompt,url,provider:"replicate"};
 }
 if(type==="AI Video") return await generateVideoAutomatically({prompt,imageUrl,model,duration,resolution,aspectRatio});
 return {status:"provider_not_configured",type,prompt,url:null};
}

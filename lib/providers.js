const REPLICATE_API_BASE = "https://api.replicate.com/v1";

export function providerStatus(){
 return { image:!!process.env.REPLICATE_API_TOKEN, video:!!process.env.REPLICATE_API_TOKEN };
}

async function parseJson(response){
 const data=await response.json().catch(()=>({}));
 if(!response.ok){ const detail=data.error?.message||data.detail||data.error; throw new Error(typeof detail==="string"?detail:"AI provider request failed."); }
 return data;
}

async function pollReplicatePrediction(data,token){
 if(["succeeded","failed","canceled"].includes(data?.status)) return data;
 const getUrl=data?.urls?.get||(data?.id?REPLICATE_API_BASE+"/predictions/"+data.id:null);
 if(!getUrl) throw new Error("Video provider returned no prediction URL.");
 for(let i=0;i<90;i++){
  await new Promise(resolve=>setTimeout(resolve,2000));
  const response=await fetch(getUrl,{headers:{Authorization:"Bearer "+token}});
  const current=await parseJson(response);
  if(["succeeded","failed","canceled"].includes(current?.status)) return current;
 }
 throw new Error("Video generation timed out.");
}

async function generateVideoWithReplicate(prompt){
 const token=process.env.REPLICATE_API_TOKEN;
 if(!token) throw new Error("Video service is not configured.");
 const input={prompt,num_frames:Number(process.env.VIDEO_FRAMES||81),aspect_ratio:process.env.VIDEO_ASPECT_RATIO||"16:9",resolution:process.env.VIDEO_RESOLUTION||"480p",frames_per_second:Number(process.env.VIDEO_FPS||16),go_fast:true,sample_shift:Number(process.env.VIDEO_SAMPLE_SHIFT||12),interpolate_output:true};
 console.info("AI Video: Replicate Wan 2.2 T2V Fast",{model:"wan-video/wan-2.2-t2v-fast",frames:input.num_frames,resolution:input.resolution,aspectRatio:input.aspect_ratio});
 const response=await fetch(REPLICATE_API_BASE+"/models/wan-video/wan-2.2-t2v-fast/predictions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,Prefer:"wait"},body:JSON.stringify({input})});
 let data=await parseJson(response);
 data=await pollReplicatePrediction(data,token);
 if(data.status!=="succeeded") throw new Error(data.error||"Video generation ended with status: "+(data.status||"unknown"));
 const output=Array.isArray(data.output)?data.output[0]:data.output;
 const url=typeof output==="string"?output:output?.url||null;
 if(!url) throw new Error("Video provider returned no video URL.");
 return {status:"completed",type:"AI Video",prompt,url,mime:"video/mp4"};
}

export async function generateMedia({type,prompt}){
 if(!prompt?.trim()) throw new Error("Prompt is required.");
 if(type==="AI Image"&&process.env.REPLICATE_API_TOKEN){
  const response=await fetch(REPLICATE_API_BASE+"/models/black-forest-labs/flux-2-pro/predictions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.REPLICATE_API_TOKEN,Prefer:"wait"},body:JSON.stringify({input:{prompt,aspect_ratio:process.env.IMAGE_ASPECT_RATIO||"1:1",resolution:process.env.IMAGE_RESOLUTION||"1 MP",output_format:process.env.IMAGE_OUTPUT_FORMAT||"webp",output_quality:Number(process.env.IMAGE_OUTPUT_QUALITY||90),safety_tolerance:Number(process.env.IMAGE_SAFETY_TOLERANCE||2)}})});
  let data=await parseJson(response);
  if(!["succeeded","failed","canceled"].includes(data.status)) data=await pollReplicatePrediction(data,process.env.REPLICATE_API_TOKEN);
  if(data.status!=="succeeded") throw new Error(data.error||"Image generation did not complete.");
  const output=Array.isArray(data.output)?data.output[0]:data.output;
  const url=typeof output==="string"?output:output?.url||null;
  if(!url) throw new Error("Image provider returned no image URL.");
  return {status:"completed",type,prompt,url};
 }
 if(type==="AI Video"){
  if(!process.env.REPLICATE_API_TOKEN) throw new Error("Video service is not configured.");
  return await generateVideoWithReplicate(prompt);
 }
 return {status:"provider_not_configured",type,prompt,url:null};
}
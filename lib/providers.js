import { InferenceClient } from "@huggingface/inference";

export function providerStatus(){
 return {
  image:!!process.env.REPLICATE_API_TOKEN,
  video:!!process.env.HF_TOKEN
 };
}

async function generateVideoWithService1(prompt){
 const token=process.env.HF_TOKEN;
 if(!token)throw new Error("Video service is not configured.");
 const client=new InferenceClient(token);
 const model=process.env.HF_VIDEO_MODEL||"Wan-AI/Wan2.2-TI2V-5B";
 const video=await client.textToVideo({
  inputs:prompt,
  model,
  provider:process.env.HF_VIDEO_PROVIDER||"auto",
  parameters:{
   num_frames:Number(process.env.HF_VIDEO_FRAMES||33),
   num_inference_steps:Number(process.env.HF_VIDEO_STEPS||30),
   guidance_scale:Number(process.env.HF_VIDEO_GUIDANCE||5)
  }
 });
 return {status:"completed",type:"AI Video",prompt,data:video,mime:"video/mp4"};
}

async function generateVideoWithService2(prompt){
 const token=process.env.HF_TOKEN;
 if(!token)throw new Error("Video service is not configured.");
 const client=new InferenceClient(token);
 const model=process.env.HF_VIDEO_FALLBACK_MODEL||"tencent/HunyuanVideo";
 const video=await client.textToVideo({
  inputs:prompt,
  model,
  provider:process.env.HF_VIDEO_FALLBACK_PROVIDER||"auto",
  parameters:{
   num_frames:Number(process.env.HF_VIDEO_FALLBACK_FRAMES||33),
   num_inference_steps:Number(process.env.HF_VIDEO_FALLBACK_STEPS||30),
   guidance_scale:Number(process.env.HF_VIDEO_FALLBACK_GUIDANCE||5)
  }
 });
 return {status:"completed",type:"AI Video",prompt,data:video,mime:"video/mp4"};
}

async function parseJson(response){
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error?.message||data.detail||data.error||"AI provider request failed.");
 return data;
}

export async function generateMedia({type,prompt}){
 if(!prompt?.trim())throw new Error("Prompt is required.");

 if(type==="AI Image"&&process.env.REPLICATE_API_TOKEN){
  const response=await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-2-pro/predictions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.REPLICATE_API_TOKEN,"Prefer":"wait"},body:JSON.stringify({input:{prompt,aspect_ratio:process.env.IMAGE_ASPECT_RATIO||"1:1",resolution:process.env.IMAGE_RESOLUTION||"1 MP",output_format:process.env.IMAGE_OUTPUT_FORMAT||"webp",output_quality:Number(process.env.IMAGE_OUTPUT_QUALITY||90),safety_tolerance:Number(process.env.IMAGE_SAFETY_TOLERANCE||2)}})});
  let data=await parseJson(response);
  if(data.status!=="succeeded"&&data.status!=="failed"&&data.status!=="canceled"){for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,2000));const poll=await fetch(data.urls?.get||`https://api.replicate.com/v1/predictions/${data.id}`,{headers:{Authorization:"Bearer "+process.env.REPLICATE_API_TOKEN}});data=await parseJson(poll);if(["succeeded","failed","canceled"].includes(data.status))break;}}
  if(data.status!=="succeeded")throw new Error(data.error||"Image generation did not complete.");
  const output=Array.isArray(data.output)?data.output[0]:data.output;
  const url=typeof output==="string"?output:output?.url||null;
  if(!url)throw new Error("Image provider returned no image URL.");
  return {status:"completed",type,prompt,url};
 }

 if(type==="AI Video"){
  if(!process.env.HF_TOKEN)throw new Error("Video service is not configured.");
  try{
   console.info("AI Video: Service 1");
   return await generateVideoWithService1(prompt);
  }catch(service1Error){
   console.warn("AI Video: Service 1 failed; trying Service 2.",{message:service1Error?.message||String(service1Error)});
   try{
    console.info("AI Video: Service 2");
    return await generateVideoWithService2(prompt);
   }catch(service2Error){
    console.error("AI Video: both services failed.",{service1:service1Error?.message||String(service1Error),service2:service2Error?.message||String(service2Error)});
    throw new Error("Video generation failed.");
   }
  }
 }

 return {status:"provider_not_configured",type,prompt,url:null};
}

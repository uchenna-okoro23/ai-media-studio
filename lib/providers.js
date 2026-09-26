export function providerStatus(){
 return {image:!!process.env.REPLICATE_API_TOKEN,video:!!process.env.VIDEO_PROVIDER_API_KEY&&!!process.env.VIDEO_MODEL_VERSION};
}

async function parseJson(response){const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error?.message||data.detail||data.error||"AI provider request failed.");return data;}

export async function generateMedia({type,prompt}){
 if(!prompt?.trim())throw new Error("Prompt is required.");

 if(type==="AI Image"&&process.env.REPLICATE_API_TOKEN){
  const response=await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-2-pro/predictions",{
   method:"POST",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.REPLICATE_API_TOKEN,"Prefer":"wait"},
   body:JSON.stringify({input:{prompt,aspect_ratio:process.env.IMAGE_ASPECT_RATIO||"1:1",resolution:process.env.IMAGE_RESOLUTION||"1 MP",output_format:process.env.IMAGE_OUTPUT_FORMAT||"webp",output_quality:Number(process.env.IMAGE_OUTPUT_QUALITY||90),safety_tolerance:Number(process.env.IMAGE_SAFETY_TOLERANCE||2)}})
  });

  let data=await parseJson(response);
  if(data.status!=="succeeded"&&data.status!=="failed"&&data.status!=="canceled"){
   for(let i=0;i<60;i++){
    await new Promise(r=>setTimeout(r,2000));
    const poll=await fetch(data.urls?.get||`https://api.replicate.com/v1/predictions/${data.id}`,{headers:{Authorization:"Bearer "+process.env.REPLICATE_API_TOKEN}});
    data=await parseJson(poll);
    if(["succeeded","failed","canceled"].includes(data.status))break;
   }
  }

  if(data.status!=="succeeded")throw new Error(data.error||"Image generation did not complete.");
  const output=Array.isArray(data.output)?data.output[0]:data.output;
  const url=typeof output==="string"?output:output?.url||null;
  if(!url)throw new Error("Image provider returned no image URL.");
  return {status:"completed",type,prompt,url};
 }

 if(type==="AI Video"&&process.env.VIDEO_PROVIDER_API_KEY&&process.env.VIDEO_MODEL_VERSION){
  const create=await fetch("https://api.replicate.com/v1/predictions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.VIDEO_PROVIDER_API_KEY,"Prefer":"wait"},body:JSON.stringify({version:process.env.VIDEO_MODEL_VERSION,input:{prompt,aspect_ratio:process.env.VIDEO_ASPECT_RATIO||"16:9",duration:Number(process.env.VIDEO_SECONDS||5)}})});
  const prediction=await parseJson(create);
  let data=prediction;
  if(data.status!=="succeeded"&&data.status!=="failed"&&data.status!=="canceled"){
   for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,2000));const poll=await fetch(data.urls?.get||`https://api.replicate.com/v1/predictions/${data.id}`,{headers:{Authorization:"Bearer "+process.env.VIDEO_PROVIDER_API_KEY}});data=await parseJson(poll);if(["succeeded","failed","canceled"].includes(data.status))break;}
  }
  if(data.status!=="succeeded")throw new Error(data.error||"Video generation did not complete.");
  const output=Array.isArray(data.output)?data.output[0]:data.output;
  return {status:"completed",type,prompt,url:output||null};
 }

 return {status:"provider_not_configured",type,prompt,url:null};
}

export function providerStatus(){
 return {image:!!process.env.IMAGE_PROVIDER_API_KEY,video:!!process.env.VIDEO_PROVIDER_API_KEY&&!!process.env.VIDEO_MODEL_VERSION};
}
async function parseJson(response){const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error?.message||data.detail||"AI provider request failed.");return data;}
export async function generateMedia({type,prompt}){
 if(!prompt?.trim())throw new Error("Prompt is required.");
 if(type==="AI Image"&&process.env.IMAGE_PROVIDER_API_KEY){
  const response=await fetch(process.env.IMAGE_PROVIDER_URL||"https://api.openai.com/v1/images/generations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.IMAGE_PROVIDER_API_KEY},body:JSON.stringify({model:process.env.IMAGE_MODEL||"gpt-image-2",prompt,n:1,size:"1024x1024"})});
  const data=await parseJson(response);
  return {status:"completed",type,prompt,url:data.data?.[0]?.url||null};
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
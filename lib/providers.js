export function providerStatus(){return {image:!!process.env.IMAGE_PROVIDER_API_KEY,video:!!process.env.VIDEO_PROVIDER_API_KEY};}
export async function generateMedia({type,prompt}){
 if(!prompt?.trim()) throw new Error("Prompt is required.");
 const imageKey=process.env.IMAGE_PROVIDER_API_KEY;
 if(type==="AI Image" && imageKey){
   const response=await fetch(process.env.IMAGE_PROVIDER_URL||"https://api.openai.com/v1/images/generations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+imageKey},body:JSON.stringify({model:process.env.IMAGE_MODEL||"gpt-image-1",prompt,n:1,size:"1024x1024"})});
   if(!response.ok) throw new Error("Image provider request failed.");
   const data=await response.json();
   return {status:"completed",type,prompt,url:data.data?.[0]?.url||null};
 }
 return {status:"provider_not_configured",type,prompt,url:null};
}
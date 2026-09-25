import {generateMedia} from "@/lib/providers";
export async function POST(request){
 try{
  const body=await request.json();
  const result=await generateMedia({type:body.type,prompt:body.prompt});
  return Response.json(result,{status:result.status==="provider_not_configured"?503:200});
 }catch(error){return Response.json({error:error.message||"Generation failed."},{status:400});}
}
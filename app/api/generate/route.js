import { generateMedia } from "@/lib/providers";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(request){
 const user=await getSessionUser();
 if(!user)return Response.json({error:"Please sign in before generating."},{status:401});
 try{
  const body=await request.json();
  const type=String(body.type||"AI Image");
  const prompt=String(body.prompt||"").trim();
  if(!prompt)return Response.json({error:"Prompt is required."},{status:400});
  if(prompt.length>2000)return Response.json({error:"Prompt is too long."},{status:400});
  const count=await db().query("select count(*)::int as count from generations where user_id=$1 and created_at>=current_date",[user.sub]);
  const used=count.rows[0].count;
  if(used>=10)return Response.json({error:"Daily free limit reached. Try again tomorrow.",used,limit:10},{status:429});
  const inserted=await db().query("insert into generations(user_id,type,prompt,status) values($1,$2,$3,'processing') returning id",[user.sub,type,prompt]);
  const id=inserted.rows[0].id;
  try{
   const result=await generateMedia({type,prompt});
   await db().query("update generations set status=$1,output_url=$2 where id=$3",[result.status,result.url||null,id]);
   return Response.json({...result,id,usage:{used:used+1,limit:10}},{status:result.status==="provider_not_configured"?503:200});
  }catch(error){await db().query("update generations set status='failed' where id=$1",[id]);throw error;}
 }catch(error){return Response.json({error:error.message||"Generation failed."},{status:400});}
}
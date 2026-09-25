import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
export async function GET(){
 const user=await getSessionUser();
 if(!user)return Response.json({error:"Authentication required."},{status:401});
 const r=await db().query("select id,type,prompt,status,output_url,created_at from generations where user_id=$1 order by created_at desc limit 50",[user.sub]);
 return Response.json({generations:r.rows});
}
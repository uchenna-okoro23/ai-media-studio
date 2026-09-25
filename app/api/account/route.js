import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
export async function GET(){
 const user=await getSessionUser();
 if(!user)return Response.json({error:"Authentication required."},{status:401});
 const r=await db().query("select count(*)::int as total,count(*) filter(where created_at>=current_date)::int as today from generations where user_id=$1",[user.sub]);
 return Response.json({user:{id:user.sub,email:user.email},usage:{total:r.rows[0].total,today:r.rows[0].today,dailyLimit:10}});
}
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
export async function GET(){
 const session=await getSessionUser();
 if(!session)return Response.json({user:null});
 const r=await db().query("select id,email,created_at from users where id=$1",[session.sub]);
 return Response.json({user:r.rows[0]||null});
}
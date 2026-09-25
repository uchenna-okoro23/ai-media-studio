import bcrypt from "bcryptjs";
import {db} from "@/lib/db";
import {signUser} from "@/lib/auth";
export async function POST(request){
 try{const {email,password}=await request.json(); const r=await db().query("select id,email,password_hash,created_at from users where email=$1",[email?.trim().toLowerCase()]); const user=r.rows[0]; if(!user||!(await bcrypt.compare(password||"",user.password_hash)))return Response.json({error:"Invalid email or password."},{status:401}); delete user.password_hash; return Response.json({user,token:signUser(user)});}
 catch(e){return Response.json({error:"Login failed."},{status:500});}}

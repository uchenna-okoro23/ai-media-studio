import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signUser, sessionCookie } from "@/lib/auth";
export async function POST(request){
 try{
  const {email,password}=await request.json();
  const r=await db().query("select id,email,password_hash,created_at from users where email=$1",[email?.trim().toLowerCase()]);
  const user=r.rows[0];
  if(!user||!(await bcrypt.compare(password||"",user.password_hash)))return Response.json({error:"Invalid email or password."},{status:401});
  delete user.password_hash;
  const response=Response.json({user});
  const c=sessionCookie(signUser(user));
  response.headers.set("Set-Cookie",`${c.name}=${encodeURIComponent(c.value)}; Max-Age=${c.maxAge}; Path=/; HttpOnly; SameSite=Lax${c.secure?"; Secure":""}`);
  return response;
 }catch{return Response.json({error:"Login failed."},{status:500});}
}
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signUser, sessionCookie } from "@/lib/auth";
export async function POST(request){
 try{
  const {email,password}=await request.json();
  if(!email?.trim()||!password||password.length<8)return Response.json({error:"Email and password of at least 8 characters are required."},{status:400});
  const hash=await bcrypt.hash(password,12);
  const r=await db().query("insert into users(email,password_hash) values($1,$2) returning id,email,created_at",[email.trim().toLowerCase(),hash]);
  const user=r.rows[0];
  const response=Response.json({user},{status:201});
  const c=sessionCookie(signUser(user));
  response.headers.set("Set-Cookie",`${c.name}=${encodeURIComponent(c.value)}; Max-Age=${c.maxAge}; Path=/; HttpOnly; SameSite=Lax${c.secure?"; Secure":""}`);
  return response;
 }catch(e){if(e.code==="23505")return Response.json({error:"An account with that email already exists."},{status:409});return Response.json({error:"Registration failed."},{status:500});}
}
import bcrypt from "bcryptjs";
import {db} from "@/lib/db";
import {signUser} from "@/lib/auth";
export async function POST(request){
 try{const {email,password}=await request.json(); if(!email||!password||password.length<8)return Response.json({error:"Email and password of at least 8 characters are required."},{status:400});
 const normalized=email.trim().toLowerCase(); const hash=await bcrypt.hash(password,12); const r=await db().query("insert into users(email,password_hash) values($1,$2) returning id,email,created_at",[normalized,hash]); const user=r.rows[0]; return Response.json({user,token:signUser(user)},{status:201});
 }catch(e){if(e.code==="23505")return Response.json({error:"An account with that email already exists."},{status:409}); return Response.json({error:"Registration failed."},{status:500});}}

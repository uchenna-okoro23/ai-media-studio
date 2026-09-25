import jwt from "jsonwebtoken";
const secret=()=>{if(!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is not configured."); return process.env.AUTH_SECRET;};
export function signUser(user){return jwt.sign({sub:String(user.id),email:user.email},secret(),{expiresIn:"30d"});}
export function verifyToken(token){return jwt.verify(token,secret());}
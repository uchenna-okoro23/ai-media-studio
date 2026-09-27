import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(request){
  const user=await getSessionUser();
  if(!user)return Response.json({error:"Authentication required."},{status:401});
  if(!process.env.PAYSTACK_SECRET_KEY)return Response.json({error:"Payments are not configured yet."},{status:503});
  let body;try{body=await request.json()}catch{return Response.json({error:"Invalid request."},{status:400})}
  const amountNgn=Number(body.amount);
  if(!Number.isFinite(amountNgn)||amountNgn<500||amountNgn>1000000)return Response.json({error:"Choose an amount between ₦500 and ₦1,000,000."},{status:400});
  const amountKobo=Math.round(amountNgn*100);
  const reference="AMS-"+user.sub.slice(0,8)+"-"+Date.now();
  const pool=db();
  await pool.query("insert into wallet_transactions(user_id,reference,type,amount_kobo,status,provider) values($1,$2,'funding',$3,'pending','paystack')",[user.sub,reference,amountKobo]);
  try{
    const origin=(process.env.APP_URL||"https://ai-media-studio-edt4.onrender.com").replace(/\/$/,"");
    const response=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{"Authorization":"Bearer "+process.env.PAYSTACK_SECRET_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:user.email,amount:String(amountKobo),currency:"NGN",reference,callback_url:origin+"/api/payments/paystack/callback"})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.status)throw new Error(data.message||"Paystack initialization failed.");
    return Response.json({authorization_url:data.data.authorization_url,reference});
  }catch(error){
    await pool.query("update wallet_transactions set status='failed' where reference=$1",[reference]);
    return Response.json({error:error.message||"Could not start payment."},{status:502});
  }
}
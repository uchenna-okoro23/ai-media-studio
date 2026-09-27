import crypto from "node:crypto";
import { db } from "@/lib/db";

function signatureIsValid(body, signature){
  if(!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected=crypto.createHmac("sha512",process.env.PAYSTACK_SECRET_KEY).update(body).digest("hex");
  try{
    return crypto.timingSafeEqual(Buffer.from(expected,"utf8"),Buffer.from(signature,"utf8"));
  }catch{
    return false;
  }
}

async function fulfillFunding(reference, tx){
  const pool=db();
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const r=await client.query("select * from wallet_transactions where reference=$1 for update",[reference]);
    const wallet=r.rows[0];
    if(!wallet) throw new Error("Payment record not found.");
    if(wallet.type!=="funding" || wallet.provider!=="paystack") throw new Error("Invalid payment record.");
    if(Number(tx.amount)!==Number(wallet.amount_kobo) || tx.currency!=="NGN") throw new Error("Payment amount mismatch.");
    if(wallet.status!=="completed"){
      await client.query("update wallet_transactions set status='completed' where reference=$1",[reference]);
      await client.query("update users set balance_kobo=balance_kobo+$1 where id=$2",[wallet.amount_kobo,wallet.user_id]);
    }
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}

export async function POST(request){
  const raw=await request.text();
  if(!signatureIsValid(raw,request.headers.get("x-paystack-signature"))) return new Response("Invalid signature.",{status:401});
  let event;
  try{ event=JSON.parse(raw); }catch{ return new Response("Invalid JSON.",{status:400}); }
  if(event.event!=="charge.success") return Response.json({received:true});
  try{
    await fulfillFunding(event.data?.reference,event.data);
    return Response.json({received:true});
  }catch(error){
    console.error("Paystack webhook fulfillment error:",error);
    return Response.json({error:"Webhook processing failed."},{status:500});
  }
}

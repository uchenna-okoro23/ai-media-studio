import { db } from "@/lib/db";

export async function GET(request){
  const reference=new URL(request.url).searchParams.get("reference");
  if(!reference)return Response.redirect(new URL("/settings?payment=missing",request.url));
  if(!process.env.PAYSTACK_SECRET_KEY)return Response.redirect(new URL("/settings?payment=unconfigured",request.url));
  const pool=db();
  try{
    const response=await fetch("https://api.paystack.co/transaction/verify/"+encodeURIComponent(reference),{headers:{Authorization:"Bearer "+process.env.PAYSTACK_SECRET_KEY}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.status||data.data?.status!=="success")return Response.redirect(new URL("/settings?payment=failed",request.url));
    const tx=data.data;
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const r=await client.query("select * from wallet_transactions where reference=$1 for update",[reference]);
      const wallet=r.rows[0];
      if(!wallet)throw new Error("Payment record not found.");
      if(wallet.status!=="completed"){
        if(Number(tx.amount)!==Number(wallet.amount_kobo))throw new Error("Payment amount mismatch.");
        await client.query("update wallet_transactions set status='completed' where reference=$1",[reference]);
        await client.query("update users set balance_kobo=balance_kobo+$1 where id=$2",[wallet.amount_kobo,wallet.user_id]);
      }
      await client.query("COMMIT");
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
    return Response.redirect(new URL("/settings?payment=success",request.url));
  }catch(error){
    console.error("Paystack verification error:",error);
    return Response.redirect(new URL("/settings?payment=error",request.url));
  }
}
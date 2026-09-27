import { db } from "@/lib/db";

async function verifyTransaction(reference){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    return await fetch("https://api.paystack.co/transaction/verify/"+encodeURIComponent(reference),{
      headers:{Authorization:"Bearer "+process.env.PAYSTACK_SECRET_KEY},
      signal:controller.signal,
      cache:"no-store",
    });
  }finally{
    clearTimeout(timeout);
  }
}

async function fulfillFunding(reference,tx){
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

export async function GET(request){
  const url=new URL(request.url);
  const reference=url.searchParams.get("reference");
  const redirect=(status)=>Response.redirect(new URL("/settings?payment="+status,request.url));

  if(!reference) return redirect("missing");
  if(!process.env.PAYSTACK_SECRET_KEY) return redirect("unconfigured");

  try{
    const response=await verifyTransaction(reference);
    const data=await response.json().catch(()=>({}));
    if(!response.ok || !data.status || data.data?.status!=="success") return redirect("failed");
    await fulfillFunding(reference,data.data);
    return redirect("success");
  }catch(error){
    console.error("Paystack verification error:",error);
    return redirect("error");
  }
}

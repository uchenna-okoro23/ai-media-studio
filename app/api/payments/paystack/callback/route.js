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

function resultPage(status){
  const messages={
    success:["Payment successful","Your AI Media Studio wallet has been funded.","Continue to Settings"],
    failed:["Payment not completed","The payment was not completed. No wallet credit was added.","Return to Settings"],
    error:["Payment verification issue","We could not verify this payment yet. Check your wallet history before trying again.","Return to Settings"],
    missing:["Payment reference missing","The payment reference was not provided.","Return to Settings"],
    unconfigured:["Payment service unavailable","Payments are not configured correctly yet.","Return to Settings"],
  };
  const [title,message,linkText]=messages[status]||messages.error;
  const settings="/settings?payment="+encodeURIComponent(status);
  const safe=(value)=>String(value).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));
  return new Response(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="2;url=${settings}"><title>${safe(title)}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d10;color:#fff}.card{max-width:420px;margin:24px;padding:28px;border:1px solid #2a2f36;border-radius:18px;background:#14171c;text-align:center}h1{font-size:24px;margin:0 0 12px}p{color:#b8bec8;line-height:1.5}a{display:inline-block;margin-top:12px;padding:12px 18px;border-radius:10px;background:#fff;color:#111;text-decoration:none;font-weight:600}</style></head>
<body><main class="card"><h1>${safe(title)}</h1><p>${safe(message)}</p><a href="${settings}">${safe(linkText)}</a></main>
<script>setTimeout(()=>location.replace(${JSON.stringify(settings)}),1200)</script></body></html>`,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}

export async function GET(request){
  const url=new URL(request.url);
  const reference=url.searchParams.get("reference");

  if(!reference) return resultPage("missing");
  if(!process.env.PAYSTACK_SECRET_KEY) return resultPage("unconfigured");

  try{
    const response=await verifyTransaction(reference);
    const data=await response.json().catch(()=>({}));
    if(!response.ok || !data.status || data.data?.status!=="success") return resultPage("failed");
    await fulfillFunding(reference,data.data);
    return resultPage("success");
  }catch(error){
    console.error("Paystack verification error:",error);
    return resultPage("error");
  }
}

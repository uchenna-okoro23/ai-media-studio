import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { generateMedia } from "@/lib/providers";
import { FREE_DAILY_GENERATIONS, reserveGenerationCharge, completeGenerationCharge, refundGenerationCharge } from "@/lib/billing";

const DAILY_LIMIT = FREE_DAILY_GENERATIONS;

async function downloadGeneratedMedia(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not retrieve generated media.");
  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer.byteLength) throw new Error("Generated media was empty.");
  return { data: Buffer.from(arrayBuffer), mime: response.headers.get("content-type") || "application/octet-stream" };
}

async function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (value && typeof value.arrayBuffer === "function") return Buffer.from(await value.arrayBuffer());
  return Buffer.from(value);
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const prompt = String(body.prompt || "").trim();
  const type = String(body.type || "AI Image").trim();
  const billingMode = String(body.billingMode || "free").trim() === "wallet" ? "wallet" : "free";
  const providerType = type === "Scene Generator" || type === "Storyboard" ? "AI Image" : type;
  if (!prompt) return Response.json({ error: "Prompt is required." }, { status: 400 });
  const supportedTypes = ["AI Image", "AI Video", "Scene Generator", "Storyboard"];
  if (!supportedTypes.includes(type)) return Response.json({ error: "Unsupported generation type." }, { status: 400 });

  const pool = db();
  const client = await pool.connect();
  let generationId = null, walletTransactionId = null, completedBillingMode = billingMode;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["generation-limit:" + user.sub]);
    const usageResult = await client.query("SELECT COUNT(*)::int AS count FROM generations WHERE user_id=$1 AND billing_mode='free' AND status IN ('processing','completed') AND created_at>=CURRENT_DATE AND created_at<CURRENT_DATE+INTERVAL '1 day'", [user.sub]);
    const usageCount = Number(usageResult.rows[0]?.count || 0);
    const generationResult = await client.query("INSERT INTO generations (user_id,type,prompt,status) VALUES ($1,$2,$3,'processing') RETURNING id", [user.sub,type,prompt]);
    generationId = generationResult.rows[0].id;
    const billing = await reserveGenerationCharge(client, { userId:user.sub, generationId, type, billingMode });
    if (billing.mode === "free_unavailable") {
      await client.query("ROLLBACK");
      return Response.json({ error:"Daily free generation limit reached. Choose Wallet Balance to continue.", limit:DAILY_LIMIT, used:usageCount, remaining:0 }, { status:429 });
    }
    if (billing.mode === "insufficient_balance") {
      await client.query("ROLLBACK");
      return Response.json({ error:"Insufficient AI Media Studio wallet balance.", requiredNgn:billing.costKobo/100, balanceNgn:billing.balanceKobo/100, freeGenerations:Math.max(0, DAILY_LIMIT-usageCount), billingMode, message:"Choose Daily Free Limit while free generations remain, or fund your wallet to use Wallet Balance." }, { status:402 });
    }
    completedBillingMode = billing.mode;
    walletTransactionId = billing.transactionId || null;
    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("Generation reservation error:", error);
    return Response.json({ error:"Could not start generation." }, { status:500 });
  } finally { client.release(); }

  try {
    const result = await generateMedia({ type:providerType, prompt });
    if (result.status === "provider_not_configured") {
      await pool.query("UPDATE generations SET status='failed',output_url=NULL,output_data=NULL,output_mime=NULL WHERE id=$1 AND user_id=$2", [generationId,user.sub]);
      await refundGenerationCharge({ userId:user.sub,generationId,transactionId:walletTransactionId });
      return Response.json({ error:"This generation service is temporarily unavailable.", id:generationId, status:"failed" }, { status:503 });
    }
    if (result.status !== "completed" || (!result.url && !result.data)) {
      await pool.query("UPDATE generations SET status='failed',output_url=NULL,output_data=NULL,output_mime=NULL WHERE id=$1 AND user_id=$2", [generationId,user.sub]);
      await refundGenerationCharge({ userId:user.sub,generationId,transactionId:walletTransactionId });
      return Response.json({ error:"Generation did not complete. Please try again.", id:generationId, status:"failed" }, { status:502 });
    }
    let mediaData, mediaMime;
    try {
      if (result.data) {
        mediaData = await toBuffer(result.data);
        mediaMime = result.mime || (type==="AI Image" ? "image/webp" : type==="AI Video" ? "video/mp4" : "application/octet-stream");
      } else {
        const downloaded = await downloadGeneratedMedia(result.url);
        mediaData = downloaded.data; mediaMime = downloaded.mime;
      }
      if (!mediaData?.length) throw new Error("Generated media was empty.");
    } catch (error) {
      console.error("Generated media storage error:", error);
      await pool.query("UPDATE generations SET status='failed',output_url=NULL,output_data=NULL,output_mime=NULL WHERE id=$1 AND user_id=$2", [generationId,user.sub]);
      await refundGenerationCharge({ userId:user.sub,generationId,transactionId:walletTransactionId });
      return Response.json({ error:"The media could not be saved. Please try again.", id:generationId }, { status:502 });
    }
    await pool.query("UPDATE generations SET status='completed',output_url=$1,output_data=$2,output_mime=$3 WHERE id=$4 AND user_id=$5", [result.url || null,mediaData,mediaMime,generationId,user.sub]);
    await completeGenerationCharge(walletTransactionId);
    const usageResult = await pool.query("SELECT COUNT(*)::int AS count FROM generations WHERE user_id=$1 AND billing_mode='free' AND status IN ('processing','completed') AND created_at>=CURRENT_DATE AND created_at<CURRENT_DATE+INTERVAL '1 day'", [user.sub]);
    const used = Number(usageResult.rows[0]?.count || 0);
    return Response.json({ id:generationId,type,prompt,status:"completed",billingMode:completedBillingMode,url:"/api/generations/"+generationId+"/media",usage:{used,limit:DAILY_LIMIT,remaining:Math.max(0,DAILY_LIMIT-used)} });
  } catch (error) {
    console.error("Generation error:", error);
    try { await pool.query("UPDATE generations SET status='failed',output_url=NULL,output_data=NULL,output_mime=NULL WHERE id=$1 AND user_id=$2", [generationId,user.sub]); } catch (updateError) { console.error("Failed to update generation status:",updateError); }
    await refundGenerationCharge({ userId:user.sub,generationId,transactionId:walletTransactionId }).catch((refundError)=>console.error("Wallet refund error:",refundError));
    return Response.json({ error:type==="AI Video" ? "Video generation failed. Please try again." : "Generation failed. Please try again.", id:generationId }, { status:502 });
  }
}
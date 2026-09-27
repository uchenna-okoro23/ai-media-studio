import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-3000) || `FFmpeg exited with code ${code}`));
    });
  });
}

function aspectFilter(aspect) {
  if (aspect === "9:16") return "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2";
  if (aspect === "1:1") return "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2";
  if (aspect === "4:5") return "scale=1080:1350:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:(oh-ih)/2";
  return "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2";
}

function escapeDrawtext(value) {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const form = await request.formData();
  const files = form.getAll("clips").filter((item) => typeof item?.arrayBuffer === "function");
  const starts = form.getAll("starts").map(Number);
  const ends = form.getAll("ends").map(Number);
  const caption = String(form.get("caption") || "").trim();
  const filter = String(form.get("filter") || "none");
  const aspect = String(form.get("aspect") || "16:9");

  if (!files.length || files.length !== starts.length || files.length !== ends.length) {
    return Response.json({ error: "Invalid clip sequence." }, { status: 400 });
  }
  if (files.length > 12) return Response.json({ error: "Maximum 12 clips per export." }, { status: 400 });
  if (files.some((_, i) => !Number.isFinite(starts[i]) || !Number.isFinite(ends[i]) || ends[i] <= starts[i])) {
    return Response.json({ error: "Invalid trim range." }, { status: 400 });
  }

  const work = await mkdir(path.join(os.tmpdir(), `ams-${randomUUID()}`), { recursive: true }).then(() => path.join(os.tmpdir(), `ams-${randomUUID()}`)).catch(async () => {
    const dir = path.join(os.tmpdir(), `ams-${randomUUID()}`);
    await mkdir(dir, { recursive: true });
    return dir;
  });
  const dir = work;
  const inputPaths = [];

  try {
    await mkdir(dir, { recursive: true });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.name || "") || ".mp4";
      const input = path.join(dir, `input-${i}${ext}`);
      await writeFile(input, Buffer.from(await file.arrayBuffer()));
      inputPaths.push(input);
    }

    const filterParts = [];
    const maps = [];
    for (let i = 0; i < inputPaths.length; i++) {
      let vf = `trim=start=${starts[i]}:end=${ends[i]},setpts=PTS-STARTPTS,${aspectFilter(aspect)}`;
      if (filter === "grayscale") vf += ",format=yuv420p,hue=s=0";
      else if (filter === "contrast") vf += ",eq=contrast=1.15:brightness=0.02";
      if (caption) vf += `,drawtext=text='${escapeDrawtext(caption)}':fontcolor=white:fontsize=52:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h-text_h-70`;
      filterParts.push(`[${i}:v]${vf}[v${i}]`);
      filterParts.push(`[${i}:a]atrim=start=${starts[i]}:end=${ends[i]},asetpts=PTS-STARTPTS[a${i}]`);
      maps.push(`[v${i}][a${i}]`);
    }
    const concat = maps.join("") + `concat=n=${inputPaths.length}:v=1:a=1[v][a]`;
    filterParts.push(concat);

    const output = path.join(dir, "export.mp4");
    const args = ["-y"];
    inputPaths.forEach((input) => args.push("-i", input));
    args.push("-filter_complex", filterParts.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", output);

    await run("ffmpeg", args, dir);
    const data = await readFile(output);

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(data.length),
        "Content-Disposition": 'attachment; filename="ai-media-studio-export.mp4"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Editor render error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Render failed." }, { status: 500 });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

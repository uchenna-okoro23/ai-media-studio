"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/app/components/Sidebar";

const DEFAULT_CLIP = {
  id: "clip-1",
  name: "Main clip",
  start: 0,
  end: 0,
  duration: 0,
  file: null,
  url: "",
};

function formatTime(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function Editor() {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [clips, setClips] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [caption, setCaption] = useState("");
  const [filter, setFilter] = useState("none");
  const [aspect, setAspect] = useState("16:9");
  const [rendering, setRendering] = useState(false);
  const [renderedUrl, setRenderedUrl] = useState("");
  const [error, setError] = useState("");

  const selected = clips.find((clip) => clip.id === selectedId) || null;

  const totalDuration = useMemo(
    () => clips.reduce((sum, clip) => sum + Math.max(0, clip.end - clip.start), 0),
    [clips]
  );

  useEffect(() => {
    return () => {
      clips.forEach((clip) => clip.url && URL.revokeObjectURL(clip.url));
    };
  }, []);

  useEffect(() => {
    if (!selected || !videoRef.current) return;
    videoRef.current.src = selected.url;
    videoRef.current.currentTime = selected.start || 0;
    videoRef.current.load();
    setPlaying(false);
  }, [selectedId]);

  function addFiles(event) {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("video/")
    );
    if (!files.length) return;

    const next = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      start: 0,
      end: 0,
      duration: 0,
      file,
      url: URL.createObjectURL(file),
    }));

    setClips((current) => [...current, ...next]);
    if (!selectedId) setSelectedId(next[0].id);
    event.target.value = "";
    setError("");
  }

  function metadataLoaded() {
    const duration = videoRef.current?.duration || 0;
    setClips((current) =>
      current.map((clip) =>
        clip.id === selectedId
          ? { ...clip, duration, end: clip.end > 0 ? Math.min(clip.end, duration) : duration }
          : clip
      )
    );
  }

  function updateClip(id, patch) {
    setClips((current) =>
      current.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip))
    );
  }

  function removeClip(id) {
    const target = clips.find((clip) => clip.id === id);
    if (target?.url) URL.revokeObjectURL(target.url);

    const next = clips.filter((clip) => clip.id !== id);
    setClips(next);
    if (selectedId === id) setSelectedId(next[0]?.id || null);
  }

  function moveClip(id, direction) {
    setClips((current) => {
      const index = current.findIndex((clip) => clip.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function playSelected() {
    const video = videoRef.current;
    if (!video || !selected) return;

    if (playing) {
      video.pause();
      setPlaying(false);
      return;
    }

    video.currentTime = Math.max(selected.start, 0);
    video.play();
    setPlaying(true);
  }

  function onTimeUpdate() {
    if (!videoRef.current || !selected) return;
    if (videoRef.current.currentTime >= selected.end) {
      videoRef.current.pause();
      videoRef.current.currentTime = selected.end;
      setPlaying(false);
    }
  }

  function seek(value) {
    if (!videoRef.current || !selected) return;
    const next = Number(value);
    videoRef.current.currentTime = next;
  }

  async function exportProject() {
    setError("");
    setRenderedUrl("");

    if (!clips.length) {
      setError("Add at least one video clip.");
      return;
    }

    if (clips.some((clip) => !clip.file || clip.end <= clip.start)) {
      setError("Every clip needs a valid trim range.");
      return;
    }

    setRendering(true);

    try {
      const form = new FormData();
      form.append("caption", caption);
      form.append("filter", filter);
      form.append("aspect", aspect);

      clips.forEach((clip) => {
        form.append("clips", clip.file, clip.name);
        form.append("starts", String(clip.start));
        form.append("ends", String(clip.end));
      });

      const response = await fetch("/api/editor/render", {
        method: "POST",
        body: form,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Export failed.");

      setRenderedUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setRendering(false);
    }
  }

  const filterCss =
    filter === "grayscale"
      ? "grayscale(1)"
      : filter === "contrast"
        ? "contrast(1.2)"
        : "none";

  return (
    <div className="shell">
      <Sidebar />
      <main className="content editorPage">
        <header>
          <div>
            <label>PRODUCTION / AI EDITOR</label>
            <h1>Build your edit</h1>
            <span>Assemble clips, trim the timeline, style the picture and export an MP4.</span>
          </div>
          <div className="editorTopActions">
            <button className="secondaryAction" onClick={() => fileInputRef.current?.click()}>
              + Add clips
            </button>
            <button className="primaryAction" onClick={exportProject} disabled={rendering || !clips.length}>
              {rendering ? "Rendering…" : "Export MP4"}
            </button>
          </div>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={addFiles}
        />

        <section className="editorWorkspace">
          <div className="editorStagePanel">
            <div className="editorStageToolbar">
              <span>{clips.length} clip{clips.length === 1 ? "" : "s"} · {formatTime(totalDuration)}</span>
              <div>
                {["16:9", "9:16", "1:1", "4:5"].map((value) => (
                  <button
                    key={value}
                    className={aspect === value ? "active" : ""}
                    onClick={() => setAspect(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="editorStage">
              {selected ? (
                <video
                  ref={videoRef}
                  src={selected.url}
                  onLoadedMetadata={metadataLoaded}
                  onTimeUpdate={onTimeUpdate}
                  onEnded={() => setPlaying(false)}
                  style={{ filter: filterCss }}
                  playsInline
                />
              ) : (
                <div className="editorEmptyStage">
                  <strong>Start your YouTube edit</strong>
                  <span>Add two or more clips to build a sequence.</span>
                  <button className="primaryAction" onClick={() => fileInputRef.current?.click()}>
                    Add video clips
                  </button>
                </div>
              )}
              {selected && caption && <div className="editorCaptionOverlay">{caption}</div>}
            </div>

            {selected && (
              <div className="editorTransport">
                <button onClick={playSelected}>{playing ? "Pause" : "Play"}</button>
                <input
                  type="range"
                  min={selected.start}
                  max={selected.end}
                  step="0.05"
                  value={Math.min(Math.max(videoRef.current?.currentTime || selected.start, selected.start), selected.end)}
                  onChange={(event) => seek(event.target.value)}
                />
                <span>{formatTime(videoRef.current?.currentTime || selected.start)} / {formatTime(selected.end)}</span>
              </div>
            )}
          </div>

          <aside className="editorInspector">
            <div className="editorInspectorSection">
              <label>CLIP</label>
              {selected ? (
                <>
                  <strong className="editorFileName">{selected.name}</strong>
                  <div className="trimFields">
                    <label>Start<input type="number" min="0" max={selected.duration} step="0.1" value={selected.start} onChange={(e) => updateClip(selected.id, { start: Math.min(Number(e.target.value), selected.end - 0.1) })} /></label>
                    <label>End<input type="number" min={selected.start + 0.1} max={selected.duration} step="0.1" value={selected.end} onChange={(e) => updateClip(selected.id, { end: Math.max(Number(e.target.value), selected.start + 0.1) })} /></label>
                  </div>
                </>
              ) : <span className="mutedText">Select a clip on the timeline.</span>}
            </div>

            <div className="editorInspectorSection">
              <label>STYLE</label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="none">Original</option>
                <option value="contrast">Cinematic contrast</option>
                <option value="grayscale">Grayscale</option>
              </select>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption overlay" />
            </div>

            <div className="editorInspectorSection">
              <label>CLIPS</label>
              <div className="clipList">
                {clips.map((clip, index) => (
                  <div key={clip.id} className={clip.id === selectedId ? "clipItem selected" : "clipItem"}>
                    <button className="clipSelect" onClick={() => setSelectedId(clip.id)}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{clip.name}</strong>
                    </button>
                    <div className="clipActions">
                      <button onClick={() => moveClip(clip.id, -1)} disabled={index === 0}>↑</button>
                      <button onClick={() => moveClip(clip.id, 1)} disabled={index === clips.length - 1}>↓</button>
                      <button onClick={() => removeClip(clip.id)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="editorTimelinePanel">
          <div className="timelineHeader">
            <div><label>TIMELINE</label><span>Drag order with ↑ ↓. Trim each source in the inspector.</span></div>
            <span>{formatTime(totalDuration)} total</span>
          </div>
          <div className="timelineRuler">
            <span>0:00</span><span>0:15</span><span>0:30</span><span>0:45</span><span>1:00</span>
          </div>
          <div className="timelineTrack">
            {clips.map((clip, index) => {
              const width = Math.max(12, ((clip.end - clip.start) / Math.max(totalDuration, 1)) * 100);
              return (
                <button
                  key={clip.id}
                  className={clip.id === selectedId ? "timelineClip selected" : "timelineClip"}
                  style={{ width: `${width}%` }}
                  onClick={() => setSelectedId(clip.id)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{clip.name}</strong>
                  <small>{formatTime(clip.end - clip.start)}</small>
                </button>
              );
            })}
            {!clips.length && <div className="timelineEmpty">Your clips will appear here.</div>}
          </div>
        </section>

        {error && <div className="notice editorNotice">{error}</div>}
        {renderedUrl && (
          <section className="editorExportResult">
            <div>
              <label>EXPORT READY</label>
              <strong>Your MP4 is ready.</strong>
              <span>Download it or continue to your YouTube project.</span>
            </div>
            <a className="primaryAction" href={renderedUrl} download="ai-media-studio-export.mp4">Download MP4</a>
          </section>
        )}
      </main>
    </div>
  );
}

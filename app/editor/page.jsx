"use client";

import { useEffect, useRef, useState } from "react";

export default function Editor() {
  const video = useRef(null);
  const canvas = useRef(null);
  const [src, setSrc] = useState("");
  const [mediaKind, setMediaKind] = useState("video");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [caption, setCaption] = useState("");
  const [filter, setFilter] = useState("none");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  function load(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (src) URL.revokeObjectURL(src);
    setSrc(URL.createObjectURL(file));
    setMediaKind(file.type.startsWith("image/") ? "image" : "video");
    setStart(0);
    setEnd(0);
    setPlaying(false);
  }

  function ready() {
    if (!video.current) return;
    const duration = video.current.duration || 0;
    setEnd(duration);
    video.current.currentTime = 0;
  }

  function play() {
    if (!video.current) return;

    if (playing) {
      video.current.pause();
      setPlaying(false);
      return;
    }

    video.current.play();
    setPlaying(true);
  }

  function seekStart(value) {
    const next = Number(value);
    setStart(next);
    if (video.current) video.current.currentTime = next;
  }

  function seekEnd(value) {
    setEnd(Number(value));
  }

  function handleTimeUpdate() {
    if (!video.current || !end) return;

    if (video.current.currentTime >= end) {
      video.current.pause();
      video.current.currentTime = end;
      setPlaying(false);
    }
  }

  function videoFilter() {
    if (filter === "grayscale") return "grayscale(1)";
    if (filter === "contrast") return "contrast(1.25)";
    return "none";
  }

  function snapshot() {
    if (!canvas.current) return;

    const canvasElement = canvas.current;
    const media = video.current || document.querySelector(".stage img");
    if (!media) return;
    canvasElement.width = media.videoWidth || media.naturalWidth || 1280;
    canvasElement.height = media.videoHeight || media.naturalHeight || 720;

    const context = canvasElement.getContext("2d");
    if (!context) return;

    context.filter = videoFilter();
    context.drawImage(
      media,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );

    if (caption) {
      context.filter = "none";
      context.font = "bold 42px sans-serif";
      context.textAlign = "center";
      context.fillStyle = "white";
      context.strokeStyle = "black";
      context.lineWidth = 6;

      const x = canvasElement.width / 2;
      const y = canvasElement.height - 60;

      context.strokeText(caption, x, y);
      context.fillText(caption, x, y);
    }

    const link = document.createElement("a");
    link.download = "ai-media-editor-frame.png";
    link.href = canvasElement.toDataURL("image/png");
    link.click();
  }

  return (
    <main className="editorShell">
      <header className="editorHeader">
        <div>
          <label>AI EDITOR</label>
          <h1>Build your edit</h1>
          <span>
            Trim, preview, style and caption media directly in your browser.
          </span>
        </div>
        <a href="/">Back to Studio</a>
      </header>

      <section className="editorGrid">
        <div className="editorPanel">
          <input
            type="file"
            accept="video/*,image/*"
            onChange={load}
          />

          {src ? (
            <>
              <div className="stage">
                {mediaKind === "image" ? (
                  <img src={src} alt="Uploaded media" style={{ display: "block", width: "100%", maxHeight: "65vh", objectFit: "contain", filter: videoFilter() }} />
                ) : (
                  <video
                    ref={video}
                    src={src}
                    onLoadedMetadata={ready}
                    onTimeUpdate={handleTimeUpdate}
                    style={{ filter: videoFilter() }}
                    controls
                  />
                )}
              </div>

              <div className="controls">
                <button onClick={play}>
                  {playing ? "Pause" : "Play"}
                </button>

                <label>
                  Start
                  <input
                    type="number"
                    min="0"
                    max={end}
                    step="0.1"
                    value={start}
                    onChange={(event) => seekStart(event.target.value)}
                  />
                </label>

                <label>
                  End
                  <input
                    type="number"
                    min={start}
                    max={video.current?.duration || end || 0}
                    step="0.1"
                    value={end}
                    onChange={(event) => seekEnd(event.target.value)}
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="emptyEditor">
              Upload a video or image to start editing.
            </div>
          )}
        </div>

        <aside className="editorPanel">
          <label>EDIT</label>

          <h2>Caption</h2>
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Add a caption overlay"
          />

          <h2>Filter</h2>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="none">Original</option>
            <option value="grayscale">Grayscale</option>
            <option value="contrast">High contrast</option>
          </select>

          <h2>Export</h2>
          <button
            className="primary"
            disabled={!src}
            onClick={snapshot}
          >
            Export current frame
          </button>

          <p>
            Frame export is lossless PNG. Video trim/export can be extended
            with server-side FFmpeg storage in the next production phase.
          </p>
        </aside>
      </section>

      <canvas ref={canvas} hidden />
    </main>
  );
}

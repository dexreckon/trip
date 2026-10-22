"use client";
import { useEffect, useRef, useState } from "react";
export default function Scanner({ onDetected }) {
  const video = useRef(null),
    handler = useRef(onDetected),
    [active, setActive] = useState(false),
    [error, setError] = useState("");
  handler.current = onDetected;
  useEffect(() => {
    if (!active) return;
    let stopped = false,
      controls;
    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video.current,
          (result, _error, c) => {
            if (result && !stopped) {
              stopped = true;
              c.stop();
              setActive(false);
              handler.current(result.getText());
            }
          },
        );
        if (stopped) controls.stop();
      } catch (e) {
        if (!stopped) {
          setError(
            "Camera unavailable. Allow camera access, use HTTPS, or paste the student’s pass code below.",
          );
          setActive(false);
        }
      }
    })();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [active]);
  return (
    <div className="scanner">
      <video
        ref={video}
        muted
        playsInline
        className={active ? "camera" : "camera hidden"}
      />
      {active ? (
        <button className="secondary" onClick={() => setActive(false)}>
          Stop camera
        </button>
      ) : (
        <button
          className="secondary"
          onClick={() => {
            setError("");
            setActive(true);
          }}
        >
          Open QR scanner
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}

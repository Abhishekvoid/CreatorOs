"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Photo upload with client-side square crop. The cropped image is handed to
 * the parent on confirm (which persists it immediately — independent of the
 * form's autosave cycle, per the onboarding spec).
 */

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const VIEWPORT = 300; // crop viewport css px
const OUTPUT = 400; // exported square px

function clampOffset(v: number, imgSide: number, scale: number) {
  const max = Math.max(0, (imgSide * scale - VIEWPORT) / 2);
  return Math.min(max, Math.max(-max, v));
}

function CropModal({
  src,
  onCancel,
  onConfirm,
}: {
  src: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const baseScale = natural ? VIEWPORT / Math.min(natural.w, natural.h) : 1;
  const scale = baseScale * zoom;

  const reclamp = useCallback(
    (z: number) =>
      setOff((o) =>
        natural
          ? {
              x: clampOffset(o.x, natural.w, baseScale * z),
              y: clampOffset(o.y, natural.h, baseScale * z),
            }
          : o,
      ),
    [natural, baseScale],
  );

  useEffect(() => {
    const up = () => (drag.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !natural) return;
    const { x, y, ox, oy } = drag.current;
    setOff({
      x: clampOffset(ox + (e.clientX - x), natural.w, scale),
      y: clampOffset(oy + (e.clientY - y), natural.h, scale),
    });
  }

  function confirm() {
    const img = imgRef.current;
    if (!img || !natural) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d")!;
    const srcSide = VIEWPORT / scale;
    const sx = natural.w / 2 - srcSide / 2 - off.x / scale;
    const sy = natural.h / 2 - srcSide / 2 - off.y / scale;
    ctx.drawImage(img, sx, sy, srcSide, srcSide, 0, 0, OUTPUT, OUTPUT);
    onConfirm(canvas.toDataURL("image/jpeg", 0.86));
  }

  return (
    <div className="fixed inset-0 z-200 grid place-items-center p-4">
      <button aria-label="Cancel crop" className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="pop-in relative w-[min(92vw,400px)] rounded-[26px] border border-line bg-paper p-5 shadow-pop">
        <div className="text-[16px] font-extrabold tracking-tight">Adjust your photo</div>
        <p className="mt-0.5 text-[12.5px] font-semibold text-muted">Drag to reposition · pinch the slider to zoom</p>

        <div
          className="relative mx-auto mt-4 cursor-grab touch-none overflow-hidden rounded-2xl bg-cream-2 active:cursor-grabbing"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
          }}
          onPointerMove={onPointerMove}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="absolute left-1/2 top-1/2 max-w-none"
            style={{
              width: natural ? natural.w * scale : "100%",
              height: natural ? natural.h * scale : undefined,
              transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))`,
            }}
          />
          {/* circular guide — the avatar renders round everywhere */}
          <div className="pointer-events-none absolute inset-3 rounded-full border-2 border-dashed border-white/80 mix-blend-difference" />
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => {
            const z = Number(e.target.value);
            setZoom(z);
            reclamp(z);
          }}
          className="mt-4 w-full accent-terra"
        />

        <div className="mt-4 flex gap-2.5">
          <button type="button" onClick={onCancel} className="btn btn-ghost flex-1 !py-3 !text-[14px]">
            Cancel
          </button>
          <button type="button" onClick={confirm} className="btn btn-primary flex-1 !py-3 !text-[14px]">
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AvatarField({
  avatar,
  name,
  error,
  onCropped,
}: {
  avatar: string | null;
  name: string;
  error: string | null;
  onCropped: (dataUrl: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const initial = (name.trim()[0] || "Y").toUpperCase();

  function takeFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setFileError("JPG, PNG or WebP only.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("That file is over 2MB — try a smaller one.");
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => setPending(String(reader.result));
    reader.readAsDataURL(file);
  }

  const shownError = fileError ?? error;

  return (
    <div>
      <div className="flex items-center gap-5">
        <button
          type="button"
          aria-label={avatar ? "Change photo" : "Upload photo"}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            takeFile(e.dataTransfer.files[0]);
          }}
          className={`group relative shrink-0 rounded-full outline-offset-3 transition-transform duration-300 ease-spring hover:scale-[1.03] ${
            dragOver ? "outline outline-2 outline-terra" : ""
          }`}
        >
          {avatar ? (
            <img src={avatar} alt="" className="size-24 rounded-full border-[3px] border-white object-cover shadow-card" />
          ) : (
            <span className="grid size-24 place-items-center rounded-full border-[3px] border-white bg-grad text-[36px] font-black text-white shadow-card">
              {initial}
            </span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 grid size-8 place-items-center rounded-full border-2 border-cream bg-ink text-cream transition-transform duration-300 ease-spring group-hover:scale-110">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </span>
        </button>

        <div>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost !px-5 !py-2.5 !text-[13.5px]">
            {avatar ? "Change photo" : "Upload photo"}
          </button>
          <p className="mt-2 text-[12px] font-semibold text-muted">Drag a file onto the circle, or click. JPG, PNG or WebP · max 2MB.</p>
        </div>
      </div>

      {shownError && <p className="mt-2 text-[12px] font-bold text-terra-deep">{shownError}</p>}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          takeFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {pending && (
        <CropModal
          src={pending}
          onCancel={() => setPending(null)}
          onConfirm={(dataUrl) => {
            setPending(null);
            onCropped(dataUrl);
          }}
        />
      )}
    </div>
  );
}

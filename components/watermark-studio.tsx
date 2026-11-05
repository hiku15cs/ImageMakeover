"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ImagePlus,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Placement = "bottom-right" | "bottom-left" | "top-right" | "center";
type Category = "Hair" | "Skin" | "Bridal" | "Nails";

const LOGO_PATH = "/Gemini_Generated_Image_fcpi34fcpi34fcpi.svg";
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const acceptedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const placements: Array<{ value: Placement; label: string }> = [
  { value: "bottom-right", label: "Bottom-right" },
  { value: "bottom-left", label: "Bottom-left" },
  { value: "top-right", label: "Top-right" },
  { value: "center", label: "Center · subtle" },
];

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The browser couldn't export this image. Try a smaller file."))),
      type,
      quality,
    );
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function WatermarkStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const logoRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Bridal");
  const [placement, setPlacement] = useState<Placement>("bottom-right");
  const [scale, setScale] = useState(22);
  const [opacity, setOpacity] = useState(75);
  const [margin, setMargin] = useState(4);
  const [isDragging, setIsDragging] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    const logo = new window.Image();
    logo.onload = () => {
      try {
        const logoCanvas = document.createElement("canvas");
        logoCanvas.width = logo.naturalWidth;
        logoCanvas.height = logo.naturalHeight;
        const logoContext = logoCanvas.getContext("2d", { willReadFrequently: true });
        if (!logoContext) throw new Error("Your browser couldn't prepare the salon logo.");
        logoContext.drawImage(logo, 0, 0);
        const pixels = logoContext.getImageData(0, 0, logoCanvas.width, logoCanvas.height);
        for (let index = 0; index < pixels.data.length; index += 4) {
          const brightness = Math.max(pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]);
          pixels.data[index + 3] = Math.round(pixels.data[index + 3] * Math.max(0, Math.min(1, (brightness - 24) / 64)));
        }
        logoContext.putImageData(pixels, 0, 0);
        logoRef.current = logoCanvas;
        setLogoReady(true);
      } catch (logoError) {
        setError(getErrorMessage(logoError));
      }
    };
    logo.onerror = () => setError("The salon logo couldn't be loaded. Check the SVG in the public folder.");
    logo.src = LOGO_PATH;

    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth.getUser().then(({ data, error: authError }) => {
        if (authError) {
          setError(`Couldn't verify your admin session: ${authError.message}`);
          return;
        }
        setUser(data.user);
        if (data.user) {
          void supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle().then(({ data: profile, error: profileError }) => {
            if (profileError) {
              setError(`Couldn't verify your staff role: ${profileError.message}`);
              return;
            }
            setUserRole(profile?.role ?? null);
          });
        }
      });
    } catch (authError) {
      setError(getErrorMessage(authError));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    const logo = logoRef.current;
    if (!canvas || !source || !logo) return;

    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Your browser couldn't create a canvas context.");
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    const logoWidth = canvas.width * (scale / 100);
    const logoHeight = logoWidth * (logo.height / logo.width);
    const padding = Math.min(canvas.width, canvas.height) * (margin / 100);
    const positions: Record<Placement, { x: number; y: number }> = {
      "bottom-right": { x: canvas.width - logoWidth - padding, y: canvas.height - logoHeight - padding },
      "bottom-left": { x: padding, y: canvas.height - logoHeight - padding },
      "top-right": { x: canvas.width - logoWidth - padding, y: padding },
      center: { x: (canvas.width - logoWidth) / 2, y: (canvas.height - logoHeight) / 2 },
    };
    const point = positions[placement];
    context.save();
    context.globalAlpha = (opacity / 100) * (placement === "center" ? 0.35 : 1);
    context.drawImage(logo, point.x, point.y, logoWidth, logoHeight);
    context.restore();
    setError("");
  }, [fileName, logoReady, margin, opacity, placement, scale]);

  const loadFile = useCallback((file: File | undefined) => {
    if (!file) return;
    setError("");
    setNotice("");
    if (!acceptedTypes.has(file.type)) {
      setError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("This image is larger than 30 MB. Choose a smaller file.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      sourceRef.current = image;
      setFileName(file.name);
      setTitle((current) => current || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError("The selected image couldn't be decoded. Please try another file.");
    };
    image.src = objectUrl;
  }, []);

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    loadFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  };
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    loadFile(event.dataTransfer.files[0]);
  };

  const downloadImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError("");
    setNotice("");
    setIsExporting(true);
    try {
      const blob = await canvasBlob(canvas, "image/png");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `image-makeover-${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Your full-resolution watermarked image has been downloaded.");
    } catch (exportError) {
      setError(getErrorMessage(exportError));
    } finally {
      setIsExporting(false);
    }
  };

  const publishImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError("");
    setNotice("");
    if (!title.trim()) {
      setError("Add a title before publishing to the portfolio.");
      return;
    }
    if (!user) {
      setError("Sign in with an admin account before publishing.");
      return;
    }
    if (userRole !== "admin" && userRole !== "staff") {
      setError("This account is signed in but doesn't have the staff role required to publish.");
      return;
    }

    setIsPublishing(true);
    let uploadedPath: string | null = null;
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
      const blob = await canvasBlob(canvas, "image/jpeg", 0.88);
      uploadedPath = `${Date.now()}-${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("portfolio")
        .upload(uploadedPath, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw new Error(`Portfolio upload failed: ${uploadError.message}`);

      const { data: publicUrl } = supabase.storage.from("portfolio").getPublicUrl(uploadedPath);
      const { error: insertError } = await supabase.from("gallery").insert({
        title: title.trim(),
        category,
        image_url: publicUrl.publicUrl,
        is_before_after: false,
        before_image_url: null,
        is_public: true,
      });
      if (insertError) {
        const { error: cleanupError } = await supabase.storage.from("portfolio").remove([uploadedPath]);
        const cleanupNote = cleanupError ? ` The uploaded file remains at ${uploadedPath}.` : " The uploaded file was removed.";
        throw new Error(`Gallery record creation failed: ${insertError.message}.${cleanupNote}`);
      }
      setNotice("Published to the public portfolio successfully.");
    } catch (publishError) {
      setError(getErrorMessage(publishError));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <main className="min-h-screen bg-brand-background">
      <header className="border-b border-brand-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-brand-muted transition hover:text-white"><ArrowLeft size={17} /> Back to Image Makeover</Link>
          <span className="font-display text-lg">Asset <span className="gold-text italic">Studio</span></span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="mb-9">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">Image Makeover · Admin</p>
          <h1 className="font-display text-4xl sm:text-5xl">Watermark <span className="gold-text italic">studio.</span></h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">Create a polished, branded asset. Your download keeps the source image’s full resolution.</p>
        </div>

        {(error || notice) && <div role={error ? "alert" : "status"} className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-400/30 bg-red-400/5 text-red-200" : "border-emerald-400/30 bg-emerald-400/5 text-emerald-200"}`}>{error ? <span aria-hidden="true">!</span> : <CheckCircle2 size={18} />}{error || notice}</div>}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
          <section className="rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-6">
            {!fileName ? (
              <label
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex min-h-[420px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center transition ${isDragging ? "border-brand-gold bg-brand-gold/5" : "border-brand-border hover:border-brand-gold/60"}`}
              >
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={handleFileInput} />
                <span className="grid h-16 w-16 place-items-center rounded-full border border-brand-gold/30 bg-brand-gold/5 text-brand-gold"><ImagePlus size={27} strokeWidth={1.4} /></span>
                <span className="mt-5 font-display text-2xl">Drop your image here</span>
                <span className="mt-2 text-sm text-brand-muted">or browse files · PNG, JPG, WebP · up to 30 MB</span>
                <span className="mt-6 rounded-full border border-brand-border px-5 py-2.5 text-sm">Choose an image</span>
              </label>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="truncate text-xs text-brand-muted">{fileName}</p>
                  <button type="button" className="shrink-0 text-xs text-brand-gold hover:text-brand-champagne" onClick={() => { sourceRef.current = null; setFileName(""); setError(""); setNotice(""); }}>Change image</button>
                </div>
                <div className="grid min-h-[360px] place-items-center overflow-hidden rounded-xl border border-brand-border bg-[#0d0e10] p-2 sm:min-h-[520px]">
                  <canvas ref={canvasRef} aria-label="Watermarked image preview" className="block max-h-[72vh] max-w-full object-contain" />
                </div>
                <p className="mt-3 text-xs text-brand-muted">Preview is scaled to fit. Export uses the original {sourceRef.current?.naturalWidth} × {sourceRef.current?.naturalHeight} px dimensions.</p>
              </>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
              <h2 className="font-display text-xl">Watermark settings</h2>
              <div className="mt-6">
                <label htmlFor="placement" className="mb-2 block text-sm">Placement</label>
                <select id="placement" value={placement} onChange={(event) => setPlacement(event.target.value as Placement)} className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold">
                  {placements.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <RangeControl id="scale" label="Logo scale" value={scale} min={10} max={35} suffix="% of width" onChange={setScale} />
              <RangeControl id="opacity" label="Logo opacity" value={opacity} min={10} max={100} suffix="%" onChange={setOpacity} />
              <RangeControl id="margin" label="Margin padding" value={margin} min={1} max={10} suffix="% of canvas" onChange={setMargin} />
            </section>

            <section className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
              <h2 className="font-display text-xl">Portfolio details</h2>
              <label htmlFor="title" className="mb-2 mt-5 block text-sm">Image title</label>
              <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="e.g. Soft bridal waves" className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none placeholder:text-brand-muted/60 focus:border-brand-gold" />
              <label htmlFor="category" className="mb-2 mt-4 block text-sm">Category</label>
              <select id="category" value={category} onChange={(event) => setCategory(event.target.value as Category)} className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold">
                {(["Hair", "Skin", "Bridal", "Nails"] as const).map((value) => <option key={value}>{value}</option>)}
              </select>
              {!user && <Link href="/login?next=%2Fadmin%2Fwatermark" className="mt-6 block rounded-full border border-brand-border px-4 py-2.5 text-center text-sm transition hover:border-brand-gold">Continue with Google to publish</Link>}
            </section>

            <div className="space-y-3">
              <button type="button" disabled={!fileName || isExporting || isPublishing} onClick={downloadImage} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gold px-5 py-3.5 text-sm font-semibold text-brand-background transition hover:bg-brand-champagne disabled:cursor-not-allowed disabled:opacity-40">
                {isExporting ? <LoaderCircle className="animate-spin" size={17} /> : <Download size={17} />} Download image
              </button>
              <button type="button" disabled={!fileName || isPublishing || isExporting} onClick={publishImage} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-gold/50 px-5 py-3.5 text-sm font-semibold text-brand-champagne transition hover:border-brand-gold hover:bg-brand-gold/5 disabled:cursor-not-allowed disabled:opacity-40">
                {isPublishing ? <LoaderCircle className="animate-spin" size={17} /> : <Upload size={17} />} Publish to portfolio
              </button>
              {!user && <p className="text-center text-xs leading-5 text-brand-muted">Publishing requires a signed-in admin session. Downloading is available without signing in.</p>}
              {user && userRole !== "admin" && userRole !== "staff" && <p className="text-center text-xs leading-5 text-amber-200">Signed in as a customer. A staff role is required to publish.</p>}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function RangeControl({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor={id} className="text-sm">{label}</label><span className="text-xs text-brand-muted">{value}{suffix.startsWith("%") ? suffix : ` ${suffix}`}</span></div>
      <input id={id} className="watermark-range w-full cursor-pointer" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <div className="mt-1 flex justify-between text-[10px] text-brand-muted"><span>{min}%</span><span>{max}%</span></div>
    </div>
  );
}

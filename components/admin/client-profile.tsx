"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Clock3, Minus, Plus, Upload } from "lucide-react";
import {
  adjustCrmPackageSessions,
  attachCrmLookbookPhoto,
  createCrmCustomerPackage,
  updateCrmClientNotes,
  type CrmClientDetails,
} from "@/app/actions/crm";
import { signOut } from "@/app/actions/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const categories = ["Hair", "Skin", "Bridal", "Nails"] as const;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maximumUploadBytes = 15 * 1024 * 1024;

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function money(value: number) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function ClientProfile({ client }: { client: CrmClientDetails }) {
  const router = useRouter();
  const [notes, setNotes] = useState(client.notes ?? "");
  const [patchTestDate, setPatchTestDate] = useState(client.patch_test_date ?? "");
  const [serviceId, setServiceId] = useState(client.services[0]?.id ?? "");
  const [totalSessions, setTotalSessions] = useState(5);
  const [expiresAt, setExpiresAt] = useState("");
  const [photoTitle, setPhotoTitle] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("Bridal");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (!allowedTypes.has(selected.type)) {
      setError("Choose a PNG, JPG, or WebP watermarked image.");
      event.target.value = "";
      return;
    }
    if (selected.size > maximumUploadBytes) {
      setError("The lookbook photo must be 15 MB or smaller.");
      event.target.value = "";
      return;
    }
    setFile(selected);
    if (!photoTitle) setPhotoTitle(selected.name.replace(/\.[^.]+$/, ""));
  }

  async function saveNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy("notes");
    try {
      await updateCrmClientNotes(client.id, notes, patchTestDate || null);
      setNotice("Private client notes saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save client notes.");
    } finally {
      setBusy("");
    }
  }

  async function createPackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy("package");
    try {
      await createCrmCustomerPackage(client.id, serviceId, totalSessions, expiresAt || null);
      setNotice("Treatment pass added to the client profile.");
      router.refresh();
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : "Could not add treatment pass.");
    } finally {
      setBusy("");
    }
  }

  async function adjustPackage(packageId: string, delta: -1 | 1) {
    setError("");
    setNotice("");
    setBusy(packageId);
    try {
      await adjustCrmPackageSessions(packageId, delta);
      setNotice("Package balance updated.");
      router.refresh();
    } catch (adjustError) {
      setError(adjustError instanceof Error ? adjustError.message : "Could not update package balance.");
    } finally {
      setBusy("");
    }
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!file) {
      setError("Choose a watermarked image to attach.");
      return;
    }
    if (!photoTitle.trim()) {
      setError("Enter a title for this lookbook photo.");
      return;
    }
    const extension = allowedTypes.get(file.type);
    if (!extension) {
      setError("Choose a PNG, JPG, or WebP watermarked image.");
      return;
    }

    setBusy("photo");
    const storagePath = `${client.id}/${crypto.randomUUID()}.${extension}`;
    let uploaded = false;
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from("customer-lookbooks")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
      uploaded = true;
      await attachCrmLookbookPhoto(client.id, photoTitle, category, storagePath);
      setFile(null);
      setPhotoTitle("");
      setNotice("Watermarked photo added to the client's private lookbook.");
      router.refresh();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Could not attach the lookbook photo.";
      if (uploaded) {
        try {
          const supabase = getSupabaseBrowserClient();
          const { error: cleanupError } = await supabase.storage.from("customer-lookbooks").remove([storagePath]);
          if (cleanupError) throw cleanupError;
        } catch (cleanupError) {
          const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "Unknown storage cleanup error";
          setError(`${message} The uploaded file could not be removed (${cleanupMessage}).`);
          setBusy("");
          return;
        }
      }
      setError(message);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen bg-brand-background">
      <header className="border-b border-brand-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm text-brand-muted transition hover:text-white"><ArrowLeft size={17} /> Client directory</Link>
          <div className="flex items-center gap-4"><span className="font-display text-lg">Client <span className="gold-text italic">profile</span></span><form action={signOut}><button className="rounded-full border border-brand-border px-3 py-2 text-xs text-brand-muted hover:border-brand-gold hover:text-white">Sign out</button></form></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-9 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">Private client record</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">{client.full_name || "Client"}<span className="gold-text italic">.</span></h1>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-brand-muted">
          {client.phone && <span className="rounded-full border border-brand-border px-3 py-1.5">{client.phone}</span>}
          <span className="rounded-full border border-brand-border px-3 py-1.5">{client.loyalty_visits} completed visits</span>
          <span className="rounded-full border border-brand-border px-3 py-1.5 text-brand-champagne">{money(client.total_spend)} lifetime spend</span>
        </div>
        {error && <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{notice}</p>}

        <div className="mt-8 grid items-start gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
            <h2 className="font-display text-2xl">Styling & care notes</h2>
            <p className="mt-2 text-xs leading-5 text-brand-muted">Private to salon staff. Record allergies, patch-test details, formulas, and preferences.</p>
            <form onSubmit={saveNotes} className="mt-5 space-y-4">
              <label className="block text-sm">Internal notes<textarea rows={6} maxLength={10000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Allergies, hair formulas, preferred makeup shade…" className="mt-2 block w-full resize-y rounded-xl border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none placeholder:text-brand-muted/60 focus:border-brand-gold" /></label>
              <label className="block text-sm">Last patch test date<input type="date" value={patchTestDate} onChange={(event) => setPatchTestDate(event.target.value)} className="mt-2 block w-full rounded-lg border border-brand-border bg-brand-background px-3 py-2.5 text-sm outline-none focus:border-brand-gold sm:max-w-xs" /></label>
              <button disabled={busy === "notes"} className="rounded-full bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-background disabled:opacity-50">{busy === "notes" ? "Saving…" : "Save private notes"}</button>
            </form>
          </section>

          <section className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
            <h2 className="font-display text-2xl">Treatment passes</h2>
            {client.packages.length ? <div className="mt-4 space-y-3">{client.packages.map((pass) => (
              <div key={pass.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border p-4">
                <div><p className="text-sm font-medium">{pass.services?.title ?? "Service pass"}</p><p className="mt-1 text-xs text-brand-muted">{pass.used_sessions} / {pass.total_sessions} sessions used{pass.expires_at ? ` · Expires ${displayDate(pass.expires_at)}` : ""}</p></div>
                <div className="flex items-center gap-2"><button type="button" aria-label="Decrement used sessions" title="Mark one session unused" disabled={busy === pass.id || pass.used_sessions === 0} onClick={() => void adjustPackage(pass.id, -1)} className="grid h-9 w-9 place-items-center rounded-full border border-brand-border text-brand-muted hover:border-brand-gold hover:text-white disabled:opacity-40"><Minus size={15} /></button><button type="button" aria-label="Increment used sessions" title="Mark one session complete" disabled={busy === pass.id || pass.used_sessions >= pass.total_sessions} onClick={() => void adjustPackage(pass.id, 1)} className="grid h-9 w-9 place-items-center rounded-full border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 disabled:opacity-40"><Plus size={15} /></button></div>
              </div>
            ))}</div> : <p className="mt-4 text-sm text-brand-muted">No treatment passes assigned yet.</p>}
            <form onSubmit={createPackage} className="mt-5 grid gap-3 border-t border-brand-border pt-5 sm:grid-cols-2">
              <label className="text-xs text-brand-muted sm:col-span-2">Service pass<select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="mt-2 block w-full rounded-lg border border-brand-border bg-brand-background px-3 py-2.5 text-sm text-white">{client.services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select></label>
              <label className="text-xs text-brand-muted">Total sessions<input type="number" min="1" max="100" required value={totalSessions} onChange={(event) => setTotalSessions(Number(event.target.value))} className="mt-2 block w-full rounded-lg border border-brand-border bg-brand-background px-3 py-2.5 text-sm text-white" /></label>
              <label className="text-xs text-brand-muted">Expiry (optional)<input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-2 block w-full rounded-lg border border-brand-border bg-brand-background px-3 py-2.5 text-sm text-white" /></label>
              <button disabled={busy === "package" || !serviceId} className="rounded-full border border-brand-gold/40 px-4 py-2.5 text-sm text-brand-champagne transition hover:bg-brand-gold/10 disabled:opacity-50 sm:col-span-2">{busy === "package" ? "Adding…" : "Add treatment pass"}</button>
            </form>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
          <div className="flex items-center gap-2"><Camera size={18} className="text-brand-gold" /><h2 className="font-display text-2xl">Private lookbook</h2></div>
          <p className="mt-2 text-xs text-brand-muted">Attach a watermarked photo from the salon studio. Only this customer and authorized staff can view it.</p>
          <form onSubmit={uploadPhoto} className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-brand-muted">Photo title<input required maxLength={120} value={photoTitle} onChange={(event) => setPhotoTitle(event.target.value)} placeholder="Bridal look, hair color…" className="mt-2 block w-full rounded-lg border border-brand-border bg-brand-background px-3 py-2.5 text-sm text-white outline-none placeholder:text-brand-muted/60 focus:border-brand-gold" /></label>
            <label className="text-xs text-brand-muted">Category<select value={category} onChange={(event) => setCategory(event.target.value as (typeof categories)[number])} className="mt-2 block w-full rounded-lg border border-brand-border bg-brand-background px-3 py-2.5 text-sm text-white">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-xs text-brand-muted">Watermarked image<input required type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} className="mt-2 block w-full text-xs text-brand-muted file:mr-2 file:rounded-full file:border-0 file:bg-brand-gold/10 file:px-3 file:py-2 file:text-xs file:text-brand-champagne" /><span className="mt-1 block text-[10px]">PNG, JPG, WebP · max 15 MB</span></label>
            <button disabled={busy === "photo"} className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-background disabled:opacity-50">{busy === "photo" ? "Uploading…" : <><Upload size={15} /> Attach to lookbook</>}</button>
          </form>
          {client.photos.length > 0 && <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{client.photos.map((photo) => (
            <a key={photo.id} href={photo.image_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-brand-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.image_url} alt={photo.title} className="aspect-[4/3] w-full object-cover" />
              <div className="p-3"><p className="truncate text-sm">{photo.title}</p><p className="mt-1 text-xs text-brand-muted">{photo.category} · {displayDate(photo.created_at)}</p></div>
            </a>
          ))}</div>}
        </section>

        <section className="mt-5 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
          <h2 className="font-display text-2xl">Appointment history</h2>
          {client.appointments.length ? <div className="mt-4 divide-y divide-brand-border">{client.appointments.map((appointment) => (
            <article key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div><p className="text-sm font-medium">{appointment.services?.title ?? "Salon appointment"}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-brand-muted"><Clock3 size={13} /> {displayDate(appointment.scheduled_at)}</p></div>
              <div className="flex items-center gap-3"><span className="rounded-full border border-brand-border px-2.5 py-1 text-[10px] capitalize text-brand-muted">{appointment.status.replace("_", " ")}</span>{appointment.status === "completed" && <span className="text-sm text-brand-champagne">{money(appointment.amount_paid)}</span>}</div>
            </article>
          ))}</div> : <p className="mt-4 text-sm text-brand-muted">No appointments on record.</p>}
        </section>
      </div>
    </main>
  );
}

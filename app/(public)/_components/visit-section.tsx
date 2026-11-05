import { ArrowUpRight, MapPin, Phone, Sparkles, Star } from "lucide-react";
import { salon } from "@/lib/salon";

export default function VisitSection({ bookingLink }: { bookingLink: string | null }) {
  return (
    <section id="visit" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-2 lg:px-8 lg:py-2">
      <div className="rounded-3xl border border-brand-border bg-gradient-to-br from-brand-surface to-[#17181d] p-7 sm:p-12">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-center">
          <div><p className="mb-4 text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">Your chair is waiting</p><h2 className="font-display text-4xl sm:text-5xl">Come say <span className="gold-text italic">hello.</span></h2><p className="mt-4 max-w-xl text-sm leading-6 text-brand-muted">Find us, call us, or send a note. We’d love to help you find your next look.</p></div>
          <div className="flex items-center gap-2 rounded-full border border-brand-gold/30 px-5 py-3 text-sm"><Star size={16} fill="currentColor" className="text-brand-gold" /><strong>4.9</strong><span className="text-brand-muted">Google Reviews</span></div>
        </div>
        <div className="mt-10 grid gap-4 border-t border-brand-border pt-8 md:grid-cols-3">
          <a href={salon.mapUrl} target="_blank" rel="noreferrer" className="group rounded-xl border border-brand-border p-5 transition hover:border-brand-gold/50">
            <MapPin size={19} className="text-brand-gold" /><p className="mt-4 text-sm font-medium">Visit the studio</p><p className="mt-1 text-sm text-brand-muted">{salon.address}</p><span className="mt-3 inline-flex items-center gap-1 text-xs text-brand-gold">Open map <ArrowUpRight size={13} /></span>
          </a>
          {salon.phone ? (
            <a href={`tel:${salon.phone}`} className="rounded-xl border border-brand-border p-5 transition hover:border-brand-gold/50"><Phone size={19} className="text-brand-gold" /><p className="mt-4 text-sm font-medium">Give us a call</p><p className="mt-1 text-sm text-brand-muted">{salon.phone}</p><span className="mt-3 inline-flex items-center gap-1 text-xs text-brand-gold">Call the salon <ArrowUpRight size={13} /></span></a>
          ) : (
            <div className="rounded-xl border border-brand-border p-5"><Phone size={19} className="text-brand-gold" /><p className="mt-4 text-sm font-medium">Give us a call</p><p className="mt-1 text-sm text-brand-muted">Set NEXT_PUBLIC_SALON_PHONE to enable click-to-call.</p></div>
          )}
          <a href={bookingLink ?? "/services"} className="rounded-xl border border-brand-border p-5 transition hover:border-brand-gold/50"><Sparkles size={19} className="text-brand-gold" /><p className="mt-4 text-sm font-medium">Book on WhatsApp</p><p className="mt-1 text-sm text-brand-muted">Let’s find a time that works for you.</p><span className="mt-3 inline-flex items-center gap-1 text-xs text-brand-gold">Start a conversation <ArrowUpRight size={13} /></span></a>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-brand-border">
          <iframe title="Map to Image Makeover" src={salon.mapEmbedUrl} width="600" height="450" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-64 w-full border-0 grayscale" />
        </div>
      </div>
    </section>
  );
}

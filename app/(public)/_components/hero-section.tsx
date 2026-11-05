import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Sparkles, Star } from "lucide-react";
import { salon } from "@/lib/salon";
import { afterImage } from "./public-content";
import OpenStatusBadge from "./open-status-badge";

export default function HeroSection({ bookingLink }: { bookingLink: string | null }) {
  return (
    <section className="hero-glow relative">
      <div className="mx-auto grid min-h-[720px] max-w-7xl items-center gap-14 px-5 py-8 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-10">
        <div className="relative z-10">
          <div className="mb-8"><OpenStatusBadge /></div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-brand-antique">The art of becoming</p>
          <h1 className="max-w-3xl font-display text-6xl leading-[.99] tracking-[-.045em] sm:text-7xl lg:text-[88px]">
            Your beauty,<br /><span className="gold-text italic">beautifully</span><br />reimagined.
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-brand-muted sm:text-lg">
            Thoughtful artistry. A little ritual. A look that feels entirely like you. Welcome to Image Makeover.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/services" className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-6 py-3.5 text-sm font-semibold text-brand-background transition hover:bg-brand-champagne">Explore Services</Link>
            <a href={bookingLink ?? "#visit"} aria-disabled={!bookingLink} className="inline-flex items-center gap-2 rounded-full border border-brand-border px-6 py-3.5 text-sm font-semibold transition hover:border-brand-gold hover:text-brand-champagne">Book on WhatsApp <ArrowUpRight size={16} /></a>
          </div>
          {!salon.whatsappNumber && <p className="mt-3 text-xs text-brand-muted">Add your WhatsApp number in environment settings to enable direct booking.</p>}
          <div className="mt-14 flex items-center gap-5 border-t border-brand-border pt-6">
            <div className="flex text-brand-gold">{Array.from({ length: 5 }, (_, index) => <Star key={index} fill="currentColor" size={17} />)}</div>
            <p className="text-sm"><strong className="font-medium">4.9 / 5</strong><span className="ml-2 text-brand-muted">Loved by our community</span></p>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[530px]">
          <div className="absolute -inset-8 rounded-full bg-brand-gold/5 blur-3xl" />
          <div className="relative overflow-hidden rounded-t-[48%] rounded-b-2xl border border-brand-gold/20 bg-brand-surface p-3 shadow-gold">
            <Image src={afterImage} alt="A polished, natural beauty look by Image Makeover" width={1000} height={1200} priority className="aspect-[.83] w-full rounded-t-[48%] rounded-b-xl object-cover" />
            <div className="absolute bottom-8 left-8 rounded-xl border border-white/15 bg-brand-background/80 px-5 py-4 backdrop-blur">
              <p className="font-display text-xl italic">Made for you.</p>
              <p className="mt-1 text-[10px] uppercase tracking-[.2em] text-brand-muted">Image Makeover · Salon & Academy</p>
            </div>
          </div>
          <div className="absolute -right-3 top-14 grid h-20 w-20 place-items-center rounded-full border border-brand-gold/40 bg-brand-surface text-brand-gold shadow-gold sm:-right-8">
            <Sparkles size={26} strokeWidth={1.2} />
          </div>
        </div>
      </div>
    </section>
  );
}

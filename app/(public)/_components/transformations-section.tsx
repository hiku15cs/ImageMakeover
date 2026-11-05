"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Scissors } from "lucide-react";
import { afterImage, beforeImage } from "./public-content";

function BeforeAfterSlider() {
  const [position, setPosition] = useState(52);

  return (
    <div className="relative isolate aspect-[4/3] overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
      <Image src={beforeImage} alt="Before makeover portrait" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <Image src={afterImage} alt="After makeover portrait" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white" style={{ left: `${position}%` }}>
        <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-brand-background/80 text-white shadow-xl">
          <ArrowRight size={18} />
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between p-4 text-xs font-semibold uppercase tracking-[0.18em]">
        <span className="rounded-full bg-black/55 px-3 py-1.5">After</span>
        <span className="rounded-full bg-black/55 px-3 py-1.5">Before</span>
      </div>
      <input
        aria-label="Compare before and after makeover"
        className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
      />
    </div>
  );
}

export default function TransformationsSection() {
  return (
    <section id="transformations" className="scroll-mt-20 border-y border-brand-border bg-brand-surface/40">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-32">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">The little details</p>
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">A change you can <span className="gold-text italic">feel.</span></h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-brand-muted">Every transformation begins with listening. Slide to see a glimpse of the artistry our team brings to every appointment.</p>
          <div className="mt-8 inline-flex items-center gap-2 text-sm text-brand-muted"><Scissors size={16} className="text-brand-gold" /> Crafted with care, never rushed</div>
        </div>
        <BeforeAfterSlider />
      </div>
    </section>
  );
}

import { ArrowUpRight, Star } from "lucide-react";
import { salon } from "@/lib/salon";
import { testimonials } from "./public-content";

export default function TestimonialsSection() {
  return (
    <section aria-labelledby="testimonials-heading" className="border-y border-brand-border bg-brand-surface/40">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">Kind words</p>
            <h2 id="testimonials-heading" className="font-display text-4xl sm:text-5xl">A little love <span className="gold-text italic">from you.</span></h2>
          </div>
          <a href={salon.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-brand-gold transition hover:text-brand-champagne">
            Read us on Google <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure key={testimonial.name} className="flex h-full flex-col rounded-2xl border border-brand-border bg-brand-surface p-6">
              <div className="flex gap-1 text-brand-gold" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill="currentColor" />)}
              </div>
              <blockquote className="mt-5 flex-1 text-sm leading-7 text-brand-foreground/90">“{testimonial.quote}”</blockquote>
              <figcaption className="mt-6 border-t border-brand-border pt-4">
                <p className="text-sm font-medium">{testimonial.name}</p>
                <p className="mt-1 text-xs text-brand-muted">{testimonial.service} · Google review</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Clock3 } from "lucide-react";
import { categories, type Category, type Service } from "./public-content";

type Props = {
  services: Service[];
  serviceError: string;
  selected: string[];
  onToggle: (id: string) => void;
  bookingLink: string | null;
};

export default function ServiceSection({ services, serviceError, selected, onToggle, bookingLink }: Props) {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const visibleServices = useMemo(
    () => category === "All" ? services : services.filter((service) => service.category === category),
    [category, services],
  );

  return (
    <section id="services" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24 lg:px-8 lg:py-32">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div><p className="mb-4 text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">A moment for yourself</p><h2 className="font-display text-4xl sm:text-5xl">The service <span className="gold-text italic">edit.</span></h2></div>
        <p className="max-w-md text-sm leading-6 text-brand-muted">From the everyday essentials to the once-in-a-lifetime, every detail is tailored to you.</p>
      </div>
      <div className="mt-10 flex gap-2 overflow-x-auto pb-2">
        {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full border px-5 py-2.5 text-sm transition ${category === item ? "border-brand-gold bg-brand-gold text-brand-background" : "border-brand-border text-brand-muted hover:border-brand-gold/60 hover:text-white"}`}>{item}</button>)}
      </div>
      {serviceError && <p role="status" className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">{serviceError} Showing the featured menu for now.</p>}
      <div className="mt-7 grid gap-3 md:grid-cols-2">
        {visibleServices.map((service) => {
          const isSelected = selected.includes(service.id);
          return (
            <article key={service.id} className={`flex flex-col justify-between gap-5 rounded-2xl border bg-brand-surface p-6 transition sm:flex-row sm:items-center ${isSelected ? "border-brand-gold/70 shadow-gold" : "border-brand-border hover:border-brand-gold/40"}`}>
              <div>
                <div className="flex items-center gap-3"><h3 className="font-display text-xl">{service.title}</h3><span className="rounded-full border border-brand-border px-2.5 py-1 text-[10px] uppercase tracking-wider text-brand-muted">{service.category}</span></div>
                <p className="mt-2 max-w-md text-sm leading-6 text-brand-muted">{service.description}</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-muted"><Clock3 size={13} /> {service.duration_minutes} min</p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-6 sm:flex-col sm:items-end">
                <span className="text-lg font-medium">₹{Number(service.price).toLocaleString("en-IN")}</span>
                <button type="button" onClick={() => onToggle(service.id)} className={`inline-flex items-center gap-1.5 text-sm ${isSelected ? "text-brand-champagne" : "text-brand-gold hover:text-brand-champagne"}`}>
                  {isSelected ? <><Check size={15} /> Selected</> : <>Select <ArrowRight size={15} /></>}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!visibleServices.length && <div className="mt-7 rounded-2xl border border-brand-border bg-brand-surface p-8 text-center text-sm text-brand-muted">No services in this category yet.</div>}
      {selected.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-brand-gold/40 bg-brand-surface/95 p-4 shadow-2xl backdrop-blur">
          <p className="text-sm">{selected.length} service{selected.length > 1 ? "s" : ""} selected</p>
          <a href={bookingLink ?? "#visit"} className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2.5 text-xs font-semibold text-brand-background">Inquire on WhatsApp <ArrowUpRight size={14} /></a>
        </div>
      )}
    </section>
  );
}

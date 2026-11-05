"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";

export default function SiteHeader({ bookingLink }: { bookingLink: string | null }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative z-30 border-b border-white/5 bg-brand-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <a href="#" className="flex items-center gap-3" aria-label="Image Makeover home">
          <Image src="/Gemini_Generated_Image_fcpi34fcpi34fcpi.svg" alt="" width={48} height={48} className="h-12 w-12 object-contain" />
          <span className="font-display text-lg tracking-wide">Image <span className="gold-text">Makeover</span></span>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-brand-muted md:flex">
          <a className="transition hover:text-white" href="#services">Services</a>
          <a className="transition hover:text-white" href="#transformations">Our work</a>
          <a className="transition hover:text-white" href="#visit">Find us</a>
          <Link href="/book" className="transition hover:text-white">Book online</Link>
          <Link href="/admin/watermark" className="transition hover:text-white">Studio</Link>
        </nav>
        <a href={bookingLink ?? "#visit"} className="hidden rounded-full bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-background transition hover:bg-brand-champagne sm:inline-flex">
          Book a visit <ArrowUpRight className="ml-1" size={16} />
        </a>
        <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} className="rounded-lg border border-brand-border p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {menuOpen && (
        <nav className="grid gap-4 border-t border-brand-border px-6 py-5 text-sm text-brand-muted md:hidden">
          <a href="#services" onClick={() => setMenuOpen(false)}>Services</a>
          <a href="#transformations" onClick={() => setMenuOpen(false)}>Our work</a>
          <a href="#visit" onClick={() => setMenuOpen(false)}>Find us</a>
          <Link href="/book" onClick={() => setMenuOpen(false)}>Book online</Link>
        </nav>
      )}
    </header>
  );
}

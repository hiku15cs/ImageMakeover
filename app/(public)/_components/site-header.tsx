"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function SiteHeader({ bookingLink }: { bookingLink: string | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;

    try {
      supabase = getSupabaseBrowserClient();
    } catch (error) {
      console.error("Could not initialize admin navigation:", error);
      return;
    }

    async function checkAdmin(userId: string | null) {
      if (!userId) {
        if (active) setIsAdmin(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Could not verify admin navigation role:", error.message);
        setIsAdmin(false);
        return;
      }
      setIsAdmin(profile?.role === "admin");
    }

    void supabase.auth.getUser().then(({ data, error }) => {
      if (error && error.name !== "AuthSessionMissingError") {
        console.error("Could not verify admin navigation session:", error.message);
      }
      void checkAdmin(data.user?.id ?? null);
    }).catch((error: unknown) => {
      if (active) setIsAdmin(false);
      console.error("Could not verify admin navigation session:", error);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void checkAdmin(session?.user.id ?? null);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="relative z-30 border-b border-white/5 bg-brand-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Image Makeover home">
          <Image src="/Gemini_Generated_Image_fcpi34fcpi34fcpi.svg" alt="" width={48} height={48} className="h-12 w-12 object-contain" />
          <span className="font-display text-lg tracking-wide">Image <span className="gold-text">Makeover</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-brand-muted md:flex">
          <Link className="transition hover:text-white" href="/services">Services</Link>
          <Link className="transition hover:text-white" href="/work">Our work</Link>
          <Link className="transition hover:text-white" href="/#visit">Find us</Link>
          <Link href="/book" className="transition hover:text-white">Book online</Link>
          <Link href="/dashboard" className="transition hover:text-white">My account</Link>
          {isAdmin && <Link href="/admin/watermark" className="transition hover:text-white">Studio</Link>}
        </nav>
        <a href={bookingLink ?? "/#visit"} className="hidden rounded-full bg-brand-gold px-5 py-2.5 text-sm font-semibold text-brand-background transition hover:bg-brand-champagne sm:inline-flex">
          Book a visit <ArrowUpRight className="ml-1" size={16} />
        </a>
        <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} className="rounded-lg border border-brand-border p-2 md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {menuOpen && (
        <nav className="grid gap-4 border-t border-brand-border px-6 py-5 text-sm text-brand-muted md:hidden">
          <Link href="/services" onClick={() => setMenuOpen(false)}>Services</Link>
          <Link href="/work" onClick={() => setMenuOpen(false)}>Our work</Link>
          <Link href="/#visit" onClick={() => setMenuOpen(false)}>Find us</Link>
          <Link href="/book" onClick={() => setMenuOpen(false)}>Book online</Link>
          <Link href="/dashboard" onClick={() => setMenuOpen(false)}>My account</Link>
          {isAdmin && <Link href="/admin/watermark" onClick={() => setMenuOpen(false)}>Studio</Link>}
        </nav>
      )}
    </header>
  );
}

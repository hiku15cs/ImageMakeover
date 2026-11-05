"use client";

import { useCallback, useEffect, useState } from "react";
import { bookingUrl } from "@/lib/salon";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import HeroSection from "./_components/hero-section";
import ServiceSection from "./_components/service-section";
import SiteFooter from "./_components/site-footer";
import SiteHeader from "./_components/site-header";
import TestimonialsSection from "./_components/testimonials-section";
import TransformationsSection from "./_components/transformations-section";
import VisitSection from "./_components/visit-section";
import { initialServices, type Service } from "./_components/public-content";

export default function HomePage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [services, setServices] = useState<Service[]>(initialServices);
  const [serviceError, setServiceError] = useState("");

  useEffect(() => {
    let active = true;
    try {
      const supabase = getSupabaseBrowserClient();
      void supabase
        .from("services")
        .select("id,title,category,description,duration_minutes,price")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            setServiceError(`Couldn't load live services: ${error.message}`);
            return;
          }
          if (data?.length) setServices(data as Service[]);
        });
    } catch (error) {
      if (active) setServiceError(error instanceof Error ? error.message : "Supabase is unavailable.");
    }
    return () => {
      active = false;
    };
  }, []);

  const selectedTitles = services
    .filter((service) => selected.includes(service.id))
    .map((service) => service.title);
  const bookingLink = bookingUrl(
    selectedTitles.length
      ? `Hello Image Makeover, I'd love to enquire about: ${selectedTitles.join(", ")}.`
      : "Hello Image Makeover, I'd love to book a consultation.",
  );
  const toggleService = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }, []);

  return (
    <main className="overflow-hidden">
      <SiteHeader bookingLink={bookingLink} />
      <HeroSection bookingLink={bookingLink} />
      <ServiceSection
        services={services}
        serviceError={serviceError}
        selected={selected}
        onToggle={toggleService}
        bookingLink={bookingLink}
      />
      <TransformationsSection />
      <VisitSection bookingLink={bookingLink} />
      <TestimonialsSection />
      <SiteFooter bookingLink={bookingLink} />
    </main>
  );
}

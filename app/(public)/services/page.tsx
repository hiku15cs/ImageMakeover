"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bookingUrl } from "@/lib/salon";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import ServiceSection from "../_components/service-section";
import SiteFooter from "../_components/site-footer";
import SiteHeader from "../_components/site-header";
import { initialServices, type Service } from "../_components/public-content";

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [serviceError, setServiceError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

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

  const selectedTitles = useMemo(
    () => services.filter((service) => selected.includes(service.id)).map((service) => service.title),
    [selected, services],
  );
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
    <main className="min-h-screen overflow-hidden">
      <SiteHeader bookingLink={bookingLink} />
      <ServiceSection
        services={services}
        serviceError={serviceError}
        selected={selected}
        onToggle={toggleService}
        bookingLink={bookingLink}
      />
      <SiteFooter bookingLink={bookingLink} />
    </main>
  );
}

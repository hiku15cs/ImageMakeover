import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CustomerDashboard, { type CustomerDashboardData } from "@/components/customer/customer-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Image Makeover | Customer Dashboard" };

export default async function CustomerDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    throw new Error(`Could not verify session: ${authError.message}`);
  }
  if (!user) redirect("/login?next=%2Fdashboard");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,phone,total_spend,loyalty_visits,role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(`Could not load your profile: ${profileError.message}`);
  if (!profile) throw new Error("Your customer profile could not be found.");
  if (profile.role !== "customer") redirect("/admin/appointments");

  const [
    { data: appointments, error: appointmentsError },
    { data: packages, error: packagesError },
    { data: photos, error: photosError },
  ] = await Promise.all([
    supabase.from("appointments")
      .select("id,scheduled_at,duration_minutes,status,amount_paid,services(title,price)")
      .eq("customer_id", user.id)
      .order("scheduled_at", { ascending: false })
      .limit(500),
    supabase.from("customer_packages")
      .select("id,total_sessions,used_sessions,purchased_at,expires_at,services(title)")
      .eq("customer_id", user.id)
      .order("purchased_at", { ascending: false }),
    supabase.from("gallery")
      .select("id,title,category,image_url,created_at")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  if (appointmentsError) throw new Error(`Could not load your appointments: ${appointmentsError.message}`);
  if (packagesError) throw new Error(`Could not load your packages: ${packagesError.message}`);
  if (photosError) throw new Error(`Could not load your lookbook: ${photosError.message}`);

  const lookbook = await Promise.all((photos ?? []).map(async (photo) => {
    if (/^https:\/\//i.test(photo.image_url)) return photo;
    const { data, error } = await supabase.storage
      .from("customer-lookbooks")
      .createSignedUrl(photo.image_url, 60 * 30);
    if (error) throw new Error(`Could not prepare lookbook image ${photo.title}: ${error.message}`);
    return { ...photo, image_url: data.signedUrl };
  }));

  const dashboardData: CustomerDashboardData = {
    profile: {
      full_name: profile.full_name,
      total_spend: Number(profile.total_spend),
      loyalty_visits: Number(profile.loyalty_visits),
    },
    appointments: (appointments ?? []).map((appointment) => {
      const service = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services;
      return {
        ...appointment,
        amount_paid: Number(appointment.amount_paid),
        services: service
          ? { title: service.title, price: Number(service.price) }
          : null,
      };
    }),
    packages: (packages ?? []).map((pass) => {
      const service = Array.isArray(pass.services) ? pass.services[0] : pass.services;
      return { ...pass, services: service ? { title: service.title } : null };
    }),
    lookbook: lookbook as CustomerDashboardData["lookbook"],
  };

  return <CustomerDashboard data={dashboardData} />;
}

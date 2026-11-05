"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CrmClientSummary = {
  id: string;
  full_name: string | null;
  phone: string | null;
  total_spend: number;
  loyalty_visits: number;
  visit_count: number;
  last_visit: string | null;
};

export type CrmMetrics = {
  monthly_appointments: number;
  repeat_customer_retention: number;
  top_service_title: string | null;
  top_service_appointments: number;
};

export type CrmService = {
  id: string;
  title: string;
  price: number;
};

export type CrmAppointment = {
  id: string;
  scheduled_at: string;
  status: string;
  amount_paid: number;
  services: { title: string } | null;
};

export type CrmPackage = {
  id: string;
  service_id: string;
  total_sessions: number;
  used_sessions: number;
  purchased_at: string;
  expires_at: string | null;
  services: { title: string } | null;
};

export type CrmPhoto = {
  id: string;
  title: string;
  category: string;
  image_url: string;
  created_at: string;
};

export type CrmClientDetails = {
  id: string;
  full_name: string | null;
  phone: string | null;
  total_spend: number;
  loyalty_visits: number;
  notes: string | null;
  patch_test_date: string | null;
  appointments: CrmAppointment[];
  packages: CrmPackage[];
  photos: CrmPhoto[];
  services: CrmService[];
};

async function requireStaff() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify session: ${authError.message}`);
  if (!user) throw new Error("Please sign in to continue.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not verify staff role: ${error.message}`);
  if (!profile || !["admin", "staff"].includes(profile.role)) {
    throw new Error("Staff access is required.");
  }
  return supabase;
}

export async function getCrmDirectoryData() {
  const supabase = await requireStaff();
  const [{ data: clients, error: clientsError }, { data: metrics, error: metricsError }] = await Promise.all([
    supabase.rpc("get_crm_customer_directory"),
    supabase.rpc("get_crm_business_metrics"),
  ]);
  if (clientsError) throw new Error(`Could not load client directory: ${clientsError.message}`);
  if (metricsError) throw new Error(`Could not load client metrics: ${metricsError.message}`);

  return {
    clients: (clients ?? []) as CrmClientSummary[],
    metrics: ((metrics ?? [])[0] ?? {
      monthly_appointments: 0,
      repeat_customer_retention: 0,
      top_service_title: null,
      top_service_appointments: 0,
    }) as CrmMetrics,
  };
}

export async function getCrmClientDetails(customerId: string): Promise<CrmClientDetails | null> {
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) return null;
  const supabase = await requireStaff();
  const [
    { data: profile, error: profileError },
    { data: privateNotes, error: notesError },
    { data: appointments, error: appointmentsError },
    { data: packages, error: packagesError },
    { data: photos, error: photosError },
    { data: services, error: servicesError },
  ] = await Promise.all([
    supabase.from("profiles")
      .select("id,full_name,phone,total_spend,loyalty_visits")
      .eq("id", customerId)
      .eq("role", "customer")
      .maybeSingle(),
    supabase.rpc("get_crm_customer_notes", { p_customer_id: customerId }),
    supabase.from("appointments")
      .select("id,scheduled_at,status,amount_paid,services(title)")
      .eq("customer_id", customerId)
      .order("scheduled_at", { ascending: false })
      .limit(500),
    supabase.from("customer_packages")
      .select("id,service_id,total_sessions,used_sessions,purchased_at,expires_at,services(title)")
      .eq("customer_id", customerId)
      .order("purchased_at", { ascending: false }),
    supabase.from("gallery")
      .select("id,title,category,image_url,created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase.from("services")
      .select("id,title,price")
      .eq("is_active", true)
      .order("title"),
  ]);
  if (profileError) throw new Error(`Could not load client profile: ${profileError.message}`);
  if (notesError) throw new Error(`Could not load private client notes: ${notesError.message}`);
  if (appointmentsError) throw new Error(`Could not load appointment history: ${appointmentsError.message}`);
  if (packagesError) throw new Error(`Could not load client packages: ${packagesError.message}`);
  if (photosError) throw new Error(`Could not load the client lookbook: ${photosError.message}`);
  if (servicesError) throw new Error(`Could not load services: ${servicesError.message}`);
  if (!profile) return null;

  const resolvedPhotos = await Promise.all((photos ?? []).map(async (photo) => {
    if (/^https:\/\//i.test(photo.image_url)) {
      return { ...photo, image_url: photo.image_url };
    }
    const { data, error } = await supabase.storage
      .from("customer-lookbooks")
      .createSignedUrl(photo.image_url, 60 * 30);
    if (error) throw new Error(`Could not sign lookbook image ${photo.title}: ${error.message}`);
    return { ...photo, image_url: data.signedUrl };
  }));

  return {
    ...profile,
    total_spend: Number(profile.total_spend),
    loyalty_visits: Number(profile.loyalty_visits),
    notes: privateNotes?.[0]?.notes ?? null,
    patch_test_date: privateNotes?.[0]?.patch_test_date ?? null,
    appointments: (appointments ?? []).map((appointment) => {
      const service = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services;
      return {
        ...appointment,
        amount_paid: Number(appointment.amount_paid),
        services: service ? { title: service.title } : null,
      };
    }) as CrmAppointment[],
    packages: (packages ?? []).map((pass) => {
      const service = Array.isArray(pass.services) ? pass.services[0] : pass.services;
      return { ...pass, services: service ? { title: service.title } : null };
    }) as CrmPackage[],
    photos: resolvedPhotos as CrmPhoto[],
    services: (services ?? []).map((service) => ({ ...service, price: Number(service.price) })) as CrmService[],
  };
}

export async function updateCrmClientNotes(
  customerId: string,
  notes: string,
  patchTestDate: string | null,
) {
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) throw new Error("Invalid client.");
  if (notes.length > 10_000) throw new Error("Notes must be 10,000 characters or fewer.");
  if (patchTestDate && !/^\d{4}-\d{2}-\d{2}$/.test(patchTestDate)) {
    throw new Error("Enter a valid patch-test date.");
  }
  const supabase = await requireStaff();
  const { error } = await supabase.rpc("update_crm_customer_notes", {
    p_customer_id: customerId,
    p_notes: notes.trim(),
    p_patch_test_date: patchTestDate || null,
  });
  if (error) throw new Error(`Could not save client notes: ${error.message}`);
}

export async function createCrmCustomerPackage(
  customerId: string,
  serviceId: string,
  totalSessions: number,
  expiresAt: string | null,
) {
  if (!/^[0-9a-f-]{36}$/i.test(customerId) || !/^[0-9a-f-]{36}$/i.test(serviceId)) {
    throw new Error("Select a valid client and service.");
  }
  if (!Number.isInteger(totalSessions) || totalSessions < 1 || totalSessions > 100) {
    throw new Error("Package sessions must be between 1 and 100.");
  }
  const supabase = await requireStaff();
  const [{ data: customer, error: customerError }, { data: service, error: serviceError }] = await Promise.all([
    supabase.from("profiles").select("id").eq("id", customerId).eq("role", "customer").maybeSingle(),
    supabase.from("services").select("id").eq("id", serviceId).eq("is_active", true).maybeSingle(),
  ]);
  if (customerError) throw new Error(`Could not verify client: ${customerError.message}`);
  if (serviceError) throw new Error(`Could not verify service: ${serviceError.message}`);
  if (!customer) throw new Error("Client profile not found.");
  if (!service) throw new Error("Choose an active service for the treatment pass.");
  const { error } = await supabase.from("customer_packages").insert({
    customer_id: customerId,
    service_id: serviceId,
    total_sessions: totalSessions,
    expires_at: expiresAt || null,
  });
  if (error) throw new Error(`Could not create package: ${error.message}`);
}

export async function adjustCrmPackageSessions(packageId: string, delta: -1 | 1) {
  if (!/^[0-9a-f-]{36}$/i.test(packageId) || ![-1, 1].includes(delta)) {
    throw new Error("Invalid package adjustment.");
  }
  const supabase = await requireStaff();
  const { error } = await supabase.rpc("adjust_customer_package_sessions", {
    p_package_id: packageId,
    p_delta: delta,
  });
  if (error) throw new Error(`Could not adjust package balance: ${error.message}`);
}

export async function attachCrmLookbookPhoto(
  customerId: string,
  title: string,
  category: string,
  storagePath: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) throw new Error("Invalid client.");
  if (!title.trim() || title.trim().length > 120) throw new Error("Photo title must be 1–120 characters.");
  if (!["Hair", "Skin", "Bridal", "Nails"].includes(category)) throw new Error("Choose a valid photo category.");
  if (!new RegExp(`^${customerId}/[0-9a-f-]{36}\\.(?:jpg|jpeg|png|webp)$`, "i").test(storagePath)) {
    throw new Error("Invalid private lookbook image path.");
  }

  const supabase = await requireStaff();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", customerId)
    .eq("role", "customer")
    .maybeSingle();
  if (profileError) throw new Error(`Could not verify client: ${profileError.message}`);
  if (!profile) throw new Error("Client profile not found.");

  const { error } = await supabase.from("gallery").insert({
    customer_id: customerId,
    title: title.trim(),
    category,
    image_url: storagePath,
    is_before_after: false,
    before_image_url: null,
    is_public: false,
  });
  if (error) throw new Error(`Could not attach photo to the client lookbook: ${error.message}`);
}

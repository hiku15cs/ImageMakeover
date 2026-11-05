"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BookingService = {
  id: string;
  title: string;
  category: string;
  description: string;
  duration_minutes: number;
  price: number;
};

export type AvailableSlot = {
  slot_at: string;
  available: boolean;
  booked_count: number;
  capacity: number;
};

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_chair"
  | "completed"
  | "cancelled";

export type QueueAppointment = {
  id: string;
  customer_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  service_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  staff_notes: string | null;
  created_at: string;
  services: { title: string; price: number } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
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

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export async function getBookingServices(): Promise<BookingService[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .select("id,title,category,description,duration_minutes,price")
    .eq("is_active", true)
    .order("title");
  if (error) throw new Error(`Couldn't load services: ${error.message}`);
  return (data ?? []) as BookingService[];
}

export async function getAvailableSlots(
  date: string,
  durationMinutes: number,
): Promise<AvailableSlot[]> {
  if (!isValidDate(date)) throw new Error("Choose a valid appointment date.");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 720) {
    throw new Error("The selected service duration is invalid.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("available_appointment_slots", {
    p_date: date,
    p_duration_minutes: durationMinutes,
  });
  if (error) throw new Error(`Couldn't load appointment slots: ${error.message}`);
  return (data ?? []) as AvailableSlot[];
}

export async function createCustomerAppointment(
  serviceId: string,
  scheduledAt: string,
  guestName: string,
  guestPhone: string,
): Promise<{ id: string | null }> {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(serviceId)) {
    throw new Error("Choose a valid service.");
  }
  const slot = new Date(scheduledAt);
  if (Number.isNaN(slot.getTime())) throw new Error("Choose a valid appointment time.");
  const name = guestName.trim();
  const phone = guestPhone.trim();
  if (!name || name.length > 120) throw new Error("Enter your name (up to 120 characters).");
  if (phone.replace(/\D/g, "").length < 8 || phone.replace(/\D/g, "").length > 15) {
    throw new Error("Enter a valid phone number.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify session: ${authError.message}`);

  if (user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: name, phone })
      .eq("id", user.id);
    if (profileError) throw new Error(`Couldn't save your contact details: ${profileError.message}`);

    const { data, error } = await supabase.rpc("create_customer_appointment", {
      p_service_id: serviceId,
      p_scheduled_at: slot.toISOString(),
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
      throw new Error("The booking was created, but its confirmation could not be read.");
    }
    return { id: data.id };
  }

  const { error } = await supabase.from("appointments").insert({
    guest_name: name,
    guest_phone: phone,
    service_id: serviceId,
    scheduled_at: slot.toISOString(),
    status: "pending",
  });
  if (error) throw new Error(error.message);
  return { id: null };
}

export async function cancelCustomerAppointment(appointmentId: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(appointmentId)) throw new Error("Invalid appointment.");
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify session: ${authError.message}`);
  if (!user) throw new Error("Sign in to cancel an appointment.");

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("customer_id", user.id);
  if (error) throw new Error(`Couldn't cancel appointment. It may be less than four hours away: ${error.message}`);
}

export async function getAdminAppointments(
  from: string,
  to: string,
): Promise<QueueAppointment[]> {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error("Invalid appointment date range.");
  }
  const supabase = await requireStaff();
  const { data, error } = await supabase
    .from("appointments")
    .select("id,customer_id,guest_name,guest_phone,service_id,scheduled_at,duration_minutes,status,staff_notes,created_at,services(title,price),profiles(full_name,phone)")
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .order("scheduled_at");
  if (error) throw new Error(`Couldn't load appointment queue: ${error.message}`);
  return (data ?? []) as unknown as QueueAppointment[];
}

export async function getAdminServices(): Promise<BookingService[]> {
  const supabase = await requireStaff();
  const { data, error } = await supabase
    .from("services")
    .select("id,title,category,description,duration_minutes,price")
    .eq("is_active", true)
    .order("title");
  if (error) throw new Error(`Couldn't load services: ${error.message}`);
  return (data ?? []) as BookingService[];
}

export async function createWalkIn(input: {
  name: string;
  phone: string;
  serviceId: string;
}): Promise<{ id: string }> {
  const name = input.name.trim();
  const phone = input.phone.replace(/\D/g, "");
  if (!name || name.length > 120) throw new Error("Enter a customer name (up to 120 characters).");
  if (phone.length < 8 || phone.length > 15) throw new Error("Enter a valid phone number.");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.serviceId)) throw new Error("Choose a valid service.");

  const supabase = await requireStaff();
  const { data, error } = await supabase.rpc("create_walkin_appointment", {
    p_guest_name: name,
    p_guest_phone: phone,
    p_service_id: input.serviceId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
    throw new Error("Walk-in was created, but its confirmation could not be read.");
  }
  return { id: data.id };
}

const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_chair", "cancelled"],
  in_chair: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export async function updateAppointmentStatus(
  appointmentId: string,
  nextStatus: AppointmentStatus,
): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(appointmentId)) throw new Error("Invalid appointment.");
  const supabase = await requireStaff();
  const { data: current, error: readError } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", appointmentId)
    .single();
  if (readError) throw new Error(`Couldn't read appointment status: ${readError.message}`);
  if (!transitions[current.status as AppointmentStatus]?.includes(nextStatus)) {
    throw new Error(`Cannot change an appointment from ${current.status} to ${nextStatus}.`);
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: nextStatus })
    .eq("id", appointmentId);
  if (error) throw new Error(`Couldn't update appointment: ${error.message}`);
}

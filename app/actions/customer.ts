"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireCustomer() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify session: ${authError.message}`);
  if (!user) throw new Error("Please sign in to manage your appointments.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not verify customer profile: ${error.message}`);
  if (!profile || profile.role !== "customer") throw new Error("Customer access is required.");
  return { supabase, user };
}

export async function cancelCustomerAppointment(appointmentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) throw new Error("Invalid appointment.");
  const { supabase, user } = await requireCustomer();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("customer_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not cancel appointment: ${error.message}`);
  if (!data) throw new Error("This appointment is no longer available to cancel.");
}

export async function rescheduleCustomerAppointment(appointmentId: string, scheduledAt: string) {
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) throw new Error("Invalid appointment.");
  const timestamp = new Date(scheduledAt);
  if (Number.isNaN(timestamp.getTime())) throw new Error("Choose a valid date and time.");

  const { supabase } = await requireCustomer();
  const { error } = await supabase.rpc("reschedule_customer_appointment", {
    p_appointment_id: appointmentId,
    p_scheduled_at: timestamp.toISOString(),
  });
  if (error) throw new Error(`Could not reschedule appointment: ${error.message}`);
}

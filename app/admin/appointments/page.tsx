import type { Metadata } from "next";
import { getAdminAppointments, getAdminServices } from "@/app/actions/appointments";
import { signOut } from "@/app/actions/auth";
import AppointmentQueue from "@/components/admin/appointment-queue";

export const metadata: Metadata = { title: "Appointment Queue | Image Makeover" };

export default async function AppointmentsPage() {
  const end = new Date();
  end.setDate(end.getDate() + 31);
  const start = new Date();
  start.setDate(start.getDate() - 90);

  try {
    const [appointments, services] = await Promise.all([
      getAdminAppointments(start.toISOString(), end.toISOString()),
      getAdminServices(),
    ]);
    return <AppointmentQueue initialAppointments={appointments} services={services} signOut={signOut} />;
  } catch (error) {
    return (
      <main className="min-h-screen bg-brand-background px-5 py-12">
        <div role="alert" className="mx-auto max-w-3xl rounded-xl border border-red-400/30 bg-brand-surface p-6 text-sm text-red-200">
          {error instanceof Error ? error.message : "Could not load the appointment dashboard."}
        </div>
      </main>
    );
  }
}

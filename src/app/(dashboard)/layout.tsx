import Topbar from "@/components/dashboard/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-gray-900">
      {/* Background layers (no watermark) */}
      <div className="fixed inset-0 -z-10">
        {/* Base */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50 to-white" />

        {/* Subtle grid (clean 2026 look) */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.7) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        {/* Soft corner glows (still black/white) */}
        <div className="absolute -top-40 left-[-160px] h-[520px] w-[520px] rounded-full bg-black/5 blur-3xl" />
        <div className="absolute -bottom-40 right-[-160px] h-[520px] w-[520px] rounded-full bg-black/5 blur-3xl" />

        {/* Ultra-light noise texture (no image file) */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.6) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />
      </div>

      <Topbar />

      {/* Space for the fixed header */}
      <main className="mx-auto w-full max-w-7xl px-6 pb-12 pt-32">
        {children}
      </main>
    </div>
  );
}

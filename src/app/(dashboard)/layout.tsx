import Topbar from "@/components/dashboard/Topbar";
import CommandPalette from "@/components/dashboard/CommandPalette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-zinc-900">
      <Topbar />
      <CommandPalette />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-14 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        <div className="animate-[fwfade_240ms_ease-out]">{children}</div>

        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes fwfade {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `,
          }}
        />
      </main>
    </div>
  );
}

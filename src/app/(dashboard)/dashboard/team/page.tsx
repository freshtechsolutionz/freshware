import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type TeamRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  account_id: string | null;
};

function initials(nameOrEmail: string | null) {
  const s = (nameOrEmail || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function TeamPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/portal?next=/dashboard/team");

  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("id, role, account_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (meErr || !me) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-gray-900">Team</div>
        <div className="mt-2 text-sm text-gray-600">Unable to load your profile.</div>
      </div>
    );
  }

  const roleUpper = String(me.role || "").toUpperCase();

  // Block CLIENT_USER completely from Team directory
  if (roleUpper === "CLIENT_USER") {
    redirect("/dashboard");
  }

  if (!me.account_id) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-gray-900">Team</div>
        <div className="mt-2 text-sm text-gray-600">Your profile is missing account_id.</div>
      </div>
    );
  }

  const accountId = me.account_id as string;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, email, avatar_url, created_at, account_id")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="fw-card-strong p-7">
        <div className="text-lg font-semibold text-gray-900">Team</div>
        <div className="mt-2 text-sm text-gray-600">{error.message}</div>
      </div>
    );
  }

  const rows = (data || []) as TeamRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-gray-900">Team</div>
          <div className="mt-1 text-sm text-gray-600">
            Everyone in your company account. Click a person to view their profile.
          </div>
        </div>

        <Link href="/dashboard/profile" className="fw-btn text-sm">
          My profile
        </Link>
      </div>

      <div className="fw-card-strong overflow-hidden p-0">
        <div className="border-b border-black/10 p-4 text-sm font-semibold text-gray-900">
          Directory ({rows.length})
        </div>

        <div className="divide-y divide-black/10">
          {rows.map((r) => {
            const label = r.full_name || r.email || r.id;
            const ini = initials(r.full_name || r.email);

            return (
              <Link
                key={r.id}
                href={`/dashboard/team/${r.id}`}
                className="block p-4 transition hover:bg-white/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-black/10 bg-white flex items-center justify-center text-xs font-semibold text-gray-800">
                      {r.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        ini
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{label}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        Role:{" "}
                        <span className="font-semibold text-gray-900">{r.role || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <span className="fw-chip">View</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

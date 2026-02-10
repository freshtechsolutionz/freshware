"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const supabase = supabaseBrowser();

type OpportunityLite = { id: string; name: string | null };
type ProfileLite = { id: string; full_name: string | null; role: string | null; account_id: string | null };

type TaskStatus = "todo" | "in_progress" | "done";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CreateTaskForm() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Current user + account scope
  const [me, setMe] = useState<ProfileLite | null>(null);

  // Form fields (match your schema)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [opportunityId, setOpportunityId] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState<string>(todayISO());

  // Dropdown data
  const [opps, setOpps] = useState<OpportunityLite[]>([]);
  const [users, setUsers] = useState<ProfileLite[]>([]);

  const canSubmit = useMemo(() => title.trim().length > 0, [title]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      setLoading(true);
      setErrorMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      if (!userId) {
        router.replace("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, account_id")
        .eq("id", userId)
        .maybeSingle();

      if (profErr) {
        if (alive) {
          setErrorMsg(profErr.message);
          setLoading(false);
        }
        return;
      }

      const profile = (prof as ProfileLite) ?? null;
      if (alive) setMe(profile);

      // Load opportunities (best effort)
      const oppRes = await supabase
        .from("opportunities")
        .select("id,name")
        .order("created_at", { ascending: false });

      if (alive) setOpps(((oppRes.data as any) ?? []) as OpportunityLite[]);

      // Load users in your org (best effort)
     const userRes = await supabase
  .from("profiles")
  .select("id,full_name,role,account_id")
  .eq("account_id", profile.account_id)
  .order("full_name", { ascending: true });

      if (alive) setUsers(((userRes.data as any) ?? []) as ProfileLite[]);

      if (alive) setLoading(false);
    }

    boot();
    return () => {
      alive = false;
    };
  }, [router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const t = title.trim();
    if (!t) {
      setErrorMsg("Title is required.");
      return;
    }

    if (!me?.id) {
      setErrorMsg("Unable to determine your user profile.");
      return;
    }

    // Multi-tenant safety: tasks should always carry account_id
    if (!me.account_id) {
      setErrorMsg("Your profile is missing account_id. Set profiles.account_id for your user before creating tasks.");
      return;
    }

    setSaving(true);

    const payload = {
      title: t,
      description: description.trim() ? description.trim() : null,
      opportunity_id: opportunityId ? opportunityId : null,
      assigned_to: assignedTo ? assignedTo : null,
      status, // enum in DB
      due_at: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      created_by: me.id,
      account_id: me.account_id,
    };

    const { error } = await supabase.from("tasks").insert(payload);

    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    router.push("/dashboard/tasks");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="rounded-3xl border bg-background p-6 shadow-sm max-w-3xl">
        <div className="h-6 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="mt-4 h-10 w-full rounded-2xl bg-gray-200 animate-pulse" />
        <div className="mt-3 h-10 w-full rounded-2xl bg-gray-200 animate-pulse" />
        <div className="mt-3 h-10 w-full rounded-2xl bg-gray-200 animate-pulse" />
        <div className="mt-6 h-10 w-40 rounded-2xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <form onSubmit={onCreate} className="rounded-3xl border bg-background p-6 shadow-sm max-w-4xl">
      {errorMsg ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <div className="text-sm font-semibold">Title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Follow up with client"
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </label>

        <label className="block">
          <div className="text-sm font-semibold">Project / Opportunity</div>
          <select
            value={opportunityId}
            onChange={(e) => setOpportunityId(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 bg-white"
          >
            <option value="">Unassigned</option>
            {opps.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name || o.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-sm font-semibold">Assign to</div>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 bg-white"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.full_name || "Unnamed") + (u.role ? ` (${u.role})` : "")}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-sm font-semibold">Status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10 bg-white"
          >
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </label>

        <label className="block">
          <div className="text-sm font-semibold">Due date</div>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </label>

        <label className="block md:col-span-2">
          <div className="text-sm font-semibold">Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add context and next steps..."
            className="mt-2 w-full min-h-[120px] rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="rounded-2xl px-4 py-2 text-sm font-semibold bg-black text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Task"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard/tasks")}
          className="rounded-2xl px-4 py-2 text-sm font-semibold border border-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      <div className="mt-6 rounded-2xl border bg-gray-50 p-4 text-xs text-gray-600">
        This task will be created under account_id:{" "}
        <span className="font-semibold">{me?.account_id || "missing"}</span>
      </div>
    </form>
  );
}

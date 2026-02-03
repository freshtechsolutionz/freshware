"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

const supabase = supabaseBrowser();

type Profile = { id: string; role: string | null; account_id: string | null };
type OpportunityLite = { id: string; name: string | null };

type Project = {
  id: string;
  opportunity_id: string;
  name: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  owner_user_id: string | null;
  created_at: string;
};

export default function ProjectsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [opps, setOpps] = useState<OpportunityLite[]>([]);
  const [oppsError, setOppsError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [opportunityId, setOpportunityId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [creating, setCreating] = useState(false);

  const role = profile?.role ?? "PENDING";
  const canCreate = useMemo(() => ["CEO", "ADMIN", "OPS"].includes(role), [role]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authErr || !user) {
      window.location.assign("/login?next=/projects");
      return;
    }

    const { data: p, error: profErr } = await supabase
      .from("profiles")
      .select("id, role, account_id")
      .eq("id", user.id)
      .single();

    if (profErr) {
      setError(profErr.message);
      setLoading(false);
      return;
    }

    setProfile(p);
    setLoading(false);
  }

  async function loadOpps() {
    setOppsError(null);
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (error) {
      setOppsError(error.message);
      return;
    }
    setOpps((data ?? []) as OpportunityLite[]);
  }

  async function loadProjects() {
    setProjectsError(null);
    const { data, error } = await supabase
      .from("projects")
      .select("id, opportunity_id, name, status, start_date, due_date, owner_user_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setProjectsError(error.message);
      return;
    }
    setProjects((data ?? []) as Project[]);
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return setProjectsError("You do not have permission to create projects.");
    if (!opportunityId) return setProjectsError("Pick an opportunity.");

    setCreating(true);
    setProjectsError(null);

    const { error } = await supabase.from("projects").insert({
      opportunity_id: opportunityId,
      name: name || null,
      status,
      owner_user_id: profile?.id ?? null,
    });

    if (error) {
      setProjectsError(error.message);
      setCreating(false);
      return;
    }

    setOpportunityId("");
    setName("");
    setStatus("active");
    setCreating(false);

    await loadProjects();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadOpps();
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (loading) return <main style={{ padding: 24 }}>Loading projects…</main>;

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Projects Error</h2>
        <p style={{ color: "crimson" }}>{error}</p>
        <button onClick={() => router.push("/dashboard")}>Back</button>{" "}
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Projects</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => router.push("/dashboard")}>← Dashboard</button>{" "}
        <button onClick={logout}>Log out</button>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd" }}>
        <b>Role:</b> {role} <br />
        <b>Account:</b> {profile?.account_id ?? "(none)"}
      </div>

      {oppsError && <p style={{ color: "crimson" }}>{oppsError}</p>}
      {projectsError && <p style={{ color: "crimson" }}>{projectsError}</p>}

      {canCreate && (
        <form onSubmit={createProject} style={{ marginTop: 16, padding: 12, border: "1px solid #ccc" }}>
          <h3 style={{ marginTop: 0 }}>Create Project</h3>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <label>
              Opportunity
              <select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} style={{ width: "100%" }}>
                <option value="">-- select --</option>
                {opps.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name ?? o.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Project name
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%" }}>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
              </select>
            </label>

            <button disabled={creating} type="submit">
              {creating ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 20 }}>
        <h3>Projects</h3>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Name</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Opportunity</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.name ?? "(no name)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.status ?? "(none)"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{p.opportunity_id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {p.created_at ? new Date(p.created_at).toLocaleString() : "(none)"}
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 8, opacity: 0.7 }}>
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

// Reads the tickets of Jira sprints for the sprint plan. READ-ONLY: it never changes anything in Jira.
// Called from the app (supabase.functions.invoke('jira-sync')) by a signed-in EDITOR only.
//
// Secrets (Dashboard > Edge Functions > Secrets). Never put them in the repo or in chat:
//   JIRA_BASE_URL    e.g. https://tatralab.atlassian.net
//   JIRA_EMAIL       the Atlassian account the token belongs to
//   JIRA_API_TOKEN   created at https://id.atlassian.com/manage-api-tokens
// SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically by Supabase.
//
// Input : { projects: ["DYC","FAS","AU"], sprints: "active" | "future" | "both" | "name", sprintName?: "Sprint 228" }
// Output: { base, total, issues: [{ key, t, type, sub, parent, project, statusName, cat, assignee, email, done }] }
// Only keys, titles, status, assignee and the done date are read (no descriptions or comments).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const clip = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);
const MAX_PAGES = 6;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // 1) Only approved editors may read Jira through this function.
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const ed = await sb.rpc("is_editor");
  if (ed.error || ed.data !== true) return json({ error: "Editors only" }, 403);

  const base = (Deno.env.get("JIRA_BASE_URL") ?? "").replace(/\/+$/, "");
  const email = Deno.env.get("JIRA_EMAIL") ?? "", token = Deno.env.get("JIRA_API_TOKEN") ?? "";
  if (!/^https:\/\/[a-z0-9-]+\.atlassian\.net$/i.test(base)) return json({ error: "JIRA_BASE_URL is missing or is not https://<site>.atlassian.net" }, 500);
  if (!email || !token) return json({ error: "JIRA_EMAIL or JIRA_API_TOKEN is not set" }, 500);

  // 2) Validate the input and build the JQL ourselves (never pass user text into JQL unescaped).
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const projects = (Array.isArray(body?.projects) ? body.projects : []).map((p: unknown) => String(p).trim().toUpperCase()).filter((p: string) => /^[A-Z][A-Z0-9_]{1,9}$/.test(p)).slice(0, 12);
  if (!projects.length) return json({ error: "Give at least one project key, like DYC" }, 400);
  const mode = ["active", "future", "both", "name"].includes(body?.sprints) ? body.sprints : "active";
  let sprintPart = "sprint in openSprints()";
  if (mode === "future") sprintPart = "sprint in futureSprints()";
  else if (mode === "both") sprintPart = "sprint in (openSprints(), futureSprints())";
  else if (mode === "name") {
    const n = clip(body?.sprintName, 80).replace(/["\\]/g, "");
    if (!n) return json({ error: "Type the sprint name" }, 400);
    sprintPart = 'sprint = "' + n + '"';
  }
  const jql = "project in (" + projects.join(",") + ") AND " + sprintPart + " ORDER BY assignee ASC, key ASC";

  // 3) Ask Jira (enhanced JQL search, paged).
  const head = { Authorization: "Basic " + btoa(email + ":" + token), Accept: "application/json", "Content-Type": "application/json" };
  const issues: any[] = []; let next: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await fetch(base + "/rest/api/3/search/jql", {
      method: "POST", headers: head,
      body: JSON.stringify({ jql, maxResults: 100, fields: ["summary", "status", "assignee", "issuetype", "project", "parent", "resolutiondate"], ...(next ? { nextPageToken: next } : {}) }),
    });
    if (!r.ok) {
      const why = r.status === 401 ? "Jira rejected the email or token (401). Check JIRA_EMAIL and JIRA_API_TOKEN." : r.status === 403 ? "This account is not allowed to read those projects (403)." : r.status === 400 ? "Jira did not accept the query (400): " + clip(await r.text(), 160) : "Jira error " + r.status;
      return json({ error: why }, 502);
    }
    const j = await r.json();
    for (const i of j.issues ?? []) {
      const f = i.fields ?? {};
      issues.push({
        key: clip(i.key, 30), t: clip(f.summary, 300), type: clip(f.issuetype?.name, 30), sub: !!f.issuetype?.subtask,
        parent: clip(f.parent?.key, 30), project: clip(f.project?.key, 12), statusName: clip(f.status?.name, 40), cat: clip(f.status?.statusCategory?.key, 20),
        assignee: clip(f.assignee?.displayName, 80), email: clip(f.assignee?.emailAddress, 120), done: clip(f.resolutiondate, 10),
      });
    }
    next = j.nextPageToken; if (j.isLast || !next) break;
  }
  return json({ base, total: issues.length, issues });
});

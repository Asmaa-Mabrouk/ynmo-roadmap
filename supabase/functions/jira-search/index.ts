// Search-as-you-type for linking a sprint task to a Jira issue. READ-ONLY: it never changes anything in Jira.
// Called from the app (supabase.functions.invoke('jira-search')) by a signed-in EDITOR only.
// Secrets are the same as jira-sync (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN); set them in Supabase only, never in the repo or chat.
//
// Input : { q: "login scr" | "DYC-123", projects?: ["DYC","FAS"] }
// Output: { base, issues: [{ key, t, type, project, statusName, cat, assignee }] }   (at most 8)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const clip = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const ed = await sb.rpc("is_editor");
  if (ed.error || ed.data !== true) return json({ error: "Editors only" }, 403);

  const base = (Deno.env.get("JIRA_BASE_URL") ?? "").replace(/\/+$/, "");
  const email = Deno.env.get("JIRA_EMAIL") ?? "", token = Deno.env.get("JIRA_API_TOKEN") ?? "";
  if (!/^https:\/\/[a-z0-9-]+\.atlassian\.net$/i.test(base)) return json({ error: "JIRA_BASE_URL is missing or is not https://<site>.atlassian.net" }, 500);
  if (!email || !token) return json({ error: "JIRA_EMAIL or JIRA_API_TOKEN is not set" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  // The JQL is built here from validated pieces; user text is reduced to letters, digits, spaces and a few safe marks.
  const q = clip(body?.q, 80).replace(/["\\*?~^{}\[\]()'<>=!&|:+]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) return json({ base, issues: [] });
  const projects = (Array.isArray(body?.projects) ? body.projects : []).map((p: unknown) => String(p).trim().toUpperCase()).filter((p: string) => /^[A-Z][A-Z0-9_]{1,9}$/.test(p)).slice(0, 12);
  const parts: string[] = [];
  if (/^[A-Za-z][A-Za-z0-9_]{1,9}-\d+$/.test(q)) parts.push('key = "' + q.toUpperCase() + '"');
  const words = q.split(" ").filter(Boolean).slice(0, 6);
  parts.push("text ~ \"" + words.map((w, i) => (i === words.length - 1 ? w + "*" : w)).join(" ") + "\"");
  const jql = (projects.length ? "project in (" + projects.join(",") + ") AND " : "") + "(" + parts.join(" OR ") + ") ORDER BY updated DESC";

  const r = await fetch(base + "/rest/api/3/search/jql", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(email + ":" + token), Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ jql, maxResults: 8, fields: ["summary", "status", "assignee", "issuetype", "project"] }),
  });
  if (!r.ok) {
    const why = r.status === 401 ? "Jira rejected the email or token (401). Check JIRA_EMAIL and JIRA_API_TOKEN." : r.status === 403 ? "This account is not allowed to read those projects (403)." : "Jira answered with an error (" + r.status + ").";
    return json({ error: why }, 502);
  }
  const j = await r.json();
  const issues = (j.issues ?? []).map((i: any) => {
    const f = i.fields ?? {};
    return { key: clip(i.key, 30), t: clip(f.summary, 300), type: clip(f.issuetype?.name, 30), project: clip(f.project?.key, 12), statusName: clip(f.status?.name, 40), cat: clip(f.status?.statusCategory?.key, 20), assignee: clip(f.assignee?.displayName, 80) };
  });
  return json({ base, issues });
});

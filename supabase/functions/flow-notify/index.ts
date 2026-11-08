// Ynmo Flow email notifications (SMTP, the same Gmail secrets notify-approval uses). Called by the app after a ticket change:
//   { type: "assigned" | "status" | "comment", issue: "<flow_issues id>", comment?: "<flow_comments id>" }
// Safety: the app never sends the text of the email. This function reads the ticket / comment from the database itself, checks that the caller
// really made that change a moment ago (so nobody can use it to email strangers with chosen words), and only writes to people who have an account.
//
// Secrets (Dashboard > Edge Functions > Secrets), all already set for notify-approval:
//   SMTP_USER, SMTP_PASS   the sending Gmail address and its App password.   SITE_URL   e.g. https://ynmo-roadmap.vercel.app
// Optional: FLOW_NOTIFY_PER_HOUR (default 60) = emails one person can trigger per hour.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// People choose what they get in Ynmo Flow > For you ("Email me"): stored in flow_cfg as np_<user id> = {m: "all" | "mine" | "off"}.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const VERSION = 1;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const WINDOW = 10 * 60 * 1000; // the change must be this recent
const fresh = (at: unknown) => { const t = Date.parse(String(at ?? "")); return Number.isFinite(t) && Date.now() - t >= -60e3 && Date.now() - t <= WINDOW; };
const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const who = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  const uid = who.data?.user?.id;
  if (who.error || !uid) return json({ error: "Not signed in" }, 401);
  const ed = await sb.rpc("is_editor");
  if (ed.error || ed.data !== true) return json({ error: "Editors only" }, 403);
  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return json({ error: "SMTP_USER / SMTP_PASS are not set" }, 500);

  let body: any; try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const type = String(body?.type), issueId = clean(body?.issue, 80), commentId = clean(body?.comment, 80);
  if (!["assigned", "status", "comment"].includes(type) || !issueId) return json({ error: "Bad request" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const per = Math.max(1, Number(Deno.env.get("FLOW_NOTIFY_PER_HOUR")) || 60);
  const used = await admin.from("flow_ai_usage").select("id", { count: "exact", head: true }).eq("uid", uid).eq("mode", "notify").gte("at", new Date(Date.now() - 3600e3).toISOString());
  if ((used.count ?? 0) >= per) return json({ error: "Too many notifications this hour (" + per + ")." }, 429);

  const me = await admin.from("profiles").select("name,email").eq("id", uid).maybeSingle();
  const myName = clean(me.data?.name, 80); if (!myName) return json({ skipped: "no profile name" });
  const iss = await admin.from("flow_issues").select("data").eq("id", issueId).maybeSingle();
  const t = iss.data?.data; if (!t) return json({ skipped: "ticket not found" });
  const last = (Array.isArray(t.hist) ? t.hist : []).slice(-1)[0] ?? {};
  const mentioned: string[] = []; let kind = "", what = "", snippet = "";

  if (type === "assigned") {
    if (!(last.f === "assignee" && low(last.by) === low(myName) && fresh(last.at) && low(last.b) === low(t.as))) return json({ skipped: "not saved yet" });
    kind = "assigned"; what = myName + " assigned this to you";
  } else if (type === "status") {
    if (!(last.f === "status" && low(last.by) === low(myName) && fresh(last.at))) return json({ skipped: "not saved yet" });
    kind = "status"; what = myName + " moved it to " + clean(last.b, 40);
  } else {
    const c = await admin.from("flow_comments").select("data").eq("id", commentId).maybeSingle(); const d = c.data?.data;
    if (!d || d.iss !== issueId || low(d.by) !== low(myName) || !fresh(d.at)) return json({ skipped: "not saved yet" });
    (Array.isArray(d.men) ? d.men : []).forEach((n: unknown) => mentioned.push(clean(n, 80)));
    snippet = clean(d.t, 400); kind = "comment"; what = myName + " commented";
  }

  // Who: mentioned people (comment), the assignee, the reporter. Never the person who made the change.
  const want = new Map<string, string>(); // lower name -> reason
  if (type === "assigned") want.set(low(t.as), "assigned");
  else {
    mentioned.forEach((n) => want.set(low(n), "mention"));
    [t.as, t.rp].forEach((n: unknown) => { if (n && !want.has(low(n))) want.set(low(n), "watch"); });
  }
  want.delete(low(myName));
  if (!want.size) return json({ sent: 0 });
  const profs = await admin.from("profiles").select("id,name,email,approved").eq("approved", true);
  const to = (profs.data ?? []).filter((p: any) => want.has(low(p.name)) && p.email).slice(0, 10);
  const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
  const link = site + "/#/flow/issue/" + encodeURIComponent(clean(t.key, 30));
  const client = new SMTPClient({ connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: user, password: pass } } });
  let sent = 0;
  try {
    for (const p of to) {
      const reason = want.get(low(p.name))!;
      const pref = await admin.from("flow_cfg").select("data").eq("id", "np_" + p.id).maybeSingle();
      const mode = String(pref.data?.data?.m ?? "all");
      if (mode === "off") continue;
      if (mode === "mine" && !(reason === "mention" || reason === "assigned")) continue;
      const head = reason === "mention" ? myName + " mentioned you" : what;
      const subject = clean("[" + t.key + "] " + head + ": " + t.t, 120);
      const text = head + " on " + t.key + " (" + clean(t.t, 200) + ").\n" + (snippet ? "\n\"" + snippet + "\"\n" : "") + "\nOpen it: " + link + "\n\nYou get this because you are " + (reason === "mention" ? "mentioned" : reason === "assigned" ? "the assignee" : "the assignee or reporter") + ". Change it in Ynmo Flow > For you > Email me.";
      const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1b1f33"><p><b>${esc(head)}</b> on <b>${esc(t.key)}</b>: ${esc(clean(t.t, 200))}</p>${snippet ? `<blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #3b6fd4;background:#f4f6fb">${esc(snippet)}</blockquote>` : ""}<p><a href="${esc(link)}" style="background:#0d8560;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open ${esc(t.key)}</a></p><p style="color:#5a6180;font-size:13px">You get this because you are ${reason === "mention" ? "mentioned" : reason === "assigned" ? "the assignee" : "the assignee or reporter"}. Change it in Ynmo Flow &rsaquo; For you &rsaquo; Email me.</p></div>`;
      await client.send({ from: `Ynmo Flow <${user}>`, to: p.email, subject, content: text, html });
      sent++;
    }
  } catch (e) { console.error(e); await client.close().catch(() => {}); await admin.from("flow_ai_usage").insert({ uid, mode: "notify", ok: false }); return json({ error: "Email could not be sent", sent }, 502); }
  await client.close().catch(() => {});
  await admin.from("flow_ai_usage").insert({ uid, mode: "notify", ok: true });
  return json({ v: VERSION, sent });
});

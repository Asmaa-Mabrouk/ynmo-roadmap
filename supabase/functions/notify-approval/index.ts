// Sends the emails for the approval flow. Called by a Supabase Database Webhook on public.profiles.
//  - UPDATE where approved changes false -> true : emails the person "you are approved"
//  - INSERT of an unapproved profile             : (optional) emails the admin "someone is waiting"
// Secrets to set (Edge Functions > Secrets):
//  SMTP_USER   Gmail address that sends the emails
//  SMTP_PASS   Gmail App password (16 characters)
//  SITE_URL    e.g. https://your-project.vercel.app
//  ADMIN_NOTIFY_EMAIL  (optional) where "new registration" emails go
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function send(to: string, subject: string, text: string, html: string) {
  const user = Deno.env.get("SMTP_USER")!, pass = Deno.env.get("SMTP_PASS")!;
  const client = new SMTPClient({ connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: user, password: pass } } });
  try {
    await client.send({ from: `Ynmo Roadmaps <${user}>`, to, subject, content: text, html });
  } finally {
    await client.close();
  }
}

Deno.serve(async (req) => {
  try {
    const p = await req.json();
    const rec = p.record, old = p.old_record, site = Deno.env.get("SITE_URL") ?? "";
    if (p.type === "UPDATE" && rec?.approved === true && old?.approved !== true && rec.email) {
      const name = rec.name || "there";
      await send(
        rec.email,
        "Your Ynmo Roadmaps access is approved",
        `Hi ${name},\n\nYour account has been approved. You can now sign in and open the roadmap:\n${site}\n\nYnmo`,
        `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1b1f33"><p>Hi ${esc(name)},</p><p>Your account has been approved. You can now sign in and open the roadmap.</p><p><a href="${esc(site)}" style="background:#0d8560;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open Ynmo Roadmaps</a></p><p style="color:#5a6180">Ynmo</p></div>`,
      );
      return new Response("approval email sent");
    }
    const admin = Deno.env.get("ADMIN_NOTIFY_EMAIL");
    if (p.type === "INSERT" && rec?.approved === false && admin) {
      await send(
        admin,
        `New registration waiting: ${rec.name || rec.email}`,
        `${rec.name || ""} (${rec.email}) registered and is waiting for your approval.\nOpen ${site} > Resources to approve.`,
        `<p>${esc(rec.name || "")} (${esc(rec.email)}) registered and is waiting for your approval.</p><p>Open <a href="${esc(site)}">Ynmo Roadmaps</a> &rsaquo; Resources to approve.</p>`,
      );
      return new Response("admin email sent");
    }
    return new Response("skipped");
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});

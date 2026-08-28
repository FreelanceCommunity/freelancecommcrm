import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const resendApiKey = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  const { to, subject, html } = await req.json();

  if (!resendApiKey) {
    console.log('Resend API key not configured, skipping email.');
    return new Response(JSON.stringify({ skipped: true, note: "API key not configured" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SaaS CRM <noreply@yourdomain.com>",
      to,
      subject,
      html,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
})

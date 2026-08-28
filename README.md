# Multi-Tenant SaaS CRM

This is a production-ready CRM tailored for service businesses, complete with a Client Portal, Support Ticketing Helpdesk, Deals Pipeline, and multi-currency Subscription/Invoice Billing.

## 🔒 Security: Locking Down Access (Invite Only)

Because this CRM is private to you and your clients, you should disable open public signups:

1. Go to your **Supabase Dashboard** -> **Authentication** -> **Providers** -> **Email**.
2. **Disable** the toggle for "Enable Signups".
3. **Save** changes.

Now, only *you* (the Admin) can create new users manually via the Supabase "Users" dashboard. To invite a client, simply create their user profile in Supabase and send them their password. 
*Note: A Math Captcha has also been added to the login screen to block basic brute-force robot scripts.*

## 🚀 Deployment to Vercel

1. Push this repository to your GitHub account.
2. Log into [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. Open the **Environment Variables** section and add the following two variables:
   - `VITE_SUPABASE_URL` = `https://dqybgsbwzpmgpjpydhmo.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = *(Paste your actual Supabase Anon Key found in Supabase -> Project Settings -> API)*
5. Click **Deploy**.

## 🌐 Custom Domain Setup (`crm.freelancecomm.site`)

Once your Vercel app finishes deploying, attach your custom subdomain:

1. In the Vercel dashboard, go to your **Project Settings** -> **Domains**.
2. Type in `crm.freelancecomm.site` and click **Add**.
3. Vercel will instruct you to configure your DNS records.
4. Go to your Domain Registrar (where you purchased `freelancecomm.site`, e.g., GoDaddy, Namecheap, HostGator).
5. Create a new **CNAME Record**:
   - **Type**: `CNAME`
   - **Name / Host**: `crm`
   - **Value / Points To**: `cname.vercel-dns.com`
6. Save the DNS record. Within a few minutes, Vercel will verify the domain and automatically apply a secure SSL certificate. Your platform will be live at `https://crm.freelancecomm.site`.

## ⚙️ Recurring Payment Notifications

The backend includes a SQL function `process_recurring_billing_notifications()` which scans for subscriptions due within 7 days and issues alerts. 
To automate this, you can set up a Cron Job in your Supabase Dashboard (Database -> Cron Jobs) to execute `SELECT public.process_recurring_billing_notifications();` daily.

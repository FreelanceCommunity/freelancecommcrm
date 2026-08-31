import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { stripe } from "../_shared/stripe.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") as string;

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("No signature", { status: 400 });

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process Stripe events idempotently
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        // Update payment status in database
        await supabase
          .from('payments')
          .update({ status: 'Succeeded' })
          .eq('stripe_payment_intent_id', paymentIntent.id);
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        await supabase
          .from('payments')
          .update({ 
            status: 'Failed', 
            error_message: paymentIntent.last_payment_error?.message 
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);
        break;
      }
      case 'invoice.paid': {
        // Find corresponding database invoice and mark as paid
        // ...
        break;
      }
      // Handle subscriptions etc.
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})

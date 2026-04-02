import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  const { next_run } = await req.json();

  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL") || Netlify.env.get("SUPABASE_URL");
  const supabaseKey = Netlify.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Netlify.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    return;
  }

  try {
    // Make a simple request to keep Supabase alive
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    console.log(`Supabase keep-alive ping completed with status: ${response.status}`);
    console.log(`Next scheduled run: ${next_run}`);
  } catch (error) {
    console.error("Failed to ping Supabase:", error);
  }
};

export const config: Config = {
  // Run every 4 days at midnight UTC
  schedule: "0 0 */4 * *",
};

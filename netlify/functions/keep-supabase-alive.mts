import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const supabaseAnonKey = Netlify.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
      },
    });

    const status = response.status;
    console.log(`Supabase ping response status: ${status}`);

    if (status === 200 || status === 404) {
      console.log("Supabase keep-alive ping succeeded");
    } else {
      console.error(`Supabase ping returned unexpected status: ${status}`);
    }
  } catch (error) {
    console.error("Failed to ping Supabase:", error);
  }

  const { next_run } = await req.json();
  console.log("Next scheduled run:", next_run);
};

export const config: Config = {
  // Run every 4 days at midnight UTC
  schedule: "0 0 */4 * *",
};

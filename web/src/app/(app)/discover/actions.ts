"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addFromDiscovery(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "");
  const city = String(formData.get("city") ?? "");
  const url = String(formData.get("url") ?? "");
  const posterUrl = String(formData.get("posterUrl") ?? "") || null;
  if (!name || !url) return;

  await supabase.from("watchers").insert({
    user_id: user.id,
    movie: `${name} (${city[0]?.toUpperCase()}${city.slice(1)})`,
    url,
    mode: "showtime_regex",
    poster_url: posterUrl,
  });

  redirect("/dashboard");
}

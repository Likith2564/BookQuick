"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addWatcherFor(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const etCode = String(formData.get("etCode") ?? "");
  const city = String(formData.get("city") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const movieName = String(formData.get("movieName") ?? "");
  const cinemaName = String(formData.get("cinemaName") ?? "").trim();
  const format = String(formData.get("format") ?? "").trim();
  if (!etCode || !city || !slug || !movieName) return;

  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const url = `https://in.bookmyshow.com/movies/${city}/${slug}/buytickets/${etCode}/${today}`;

  await supabase.from("watchers").insert({
    user_id: user.id,
    movie: `${movieName} (${city[0].toUpperCase()}${city.slice(1)})`,
    url,
    mode: "showtime_regex",
    cinema_name: cinemaName || null,
    format: format || null,
  });

  redirect("/dashboard");
}

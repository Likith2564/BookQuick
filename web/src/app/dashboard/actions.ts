"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addWatcher(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const movie = String(formData.get("movie") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const mode = String(formData.get("mode") ?? "showtime_regex");
  const openMarker = String(formData.get("open_marker") ?? "").trim();
  const closedMarker = String(formData.get("closed_marker") ?? "").trim();
  const cinemaName = String(formData.get("cinema_name") ?? "").trim();
  const format = String(formData.get("format") ?? "").trim();

  if (!movie || !url) return;

  await supabase.from("watchers").insert({
    user_id: user.id,
    movie,
    url,
    mode,
    open_marker: openMarker || null,
    closed_marker: closedMarker || null,
    cinema_name: cinemaName || null,
    format: format || null,
  });

  revalidatePath("/dashboard");
}

export async function deleteWatcher(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // RLS also enforces this, but scoping explicitly avoids relying on it alone.
  await supabase.from("watchers").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

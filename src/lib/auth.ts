import "server-only";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export async function requireOwner() {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!user || !ownerEmail || user.email?.toLowerCase() !== ownerEmail) redirect("/login");
  return { supabase, user };
}
"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";

const profileSchema = z.object({ fullName: z.string().trim().min(1).max(120) });

export async function createProfile(formData: FormData) {
  const { supabase, user } = await requireOwner();
  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) redirect("/dashboard/setup?error=invalid");

  const slug = randomBytes(12).toString("base64url").slice(0, 16);
  const { error } = await supabase.from("profiles").insert({ owner_id: user.id, slug, full_name: parsed.data.fullName });
  if (error) redirect("/dashboard/setup?error=save");
  redirect("/dashboard");
}

export async function signOut() {
  const { supabase } = await requireOwner();
  await supabase.auth.signOut();
  redirect("/login");
}
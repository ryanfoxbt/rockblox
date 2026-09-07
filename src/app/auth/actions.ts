"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export interface AuthFormState {
  error?: string;
}

function fieldString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = fieldString(formData, "name");
  const email = fieldString(formData, "email");
  const password = String(formData.get("password") ?? "");
  const next = fieldString(formData, "next") || "/my";

  if (!name || !email || password.length < 8) {
    return { error: "Enter a name, a valid email, and a password of at least 8 characters." };
  }

  const { error } = await auth.signUp.email({ name, email, password });
  if (error) return { error: error.message ?? "Could not create your account." };

  redirect(next);
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = fieldString(formData, "email");
  const password = String(formData.get("password") ?? "");
  const next = fieldString(formData, "next") || "/my";

  if (!email || !password) return { error: "Enter your email and password." };

  const { error } = await auth.signIn.email({ email, password });
  if (error) return { error: error.message ?? "Wrong email or password." };

  redirect(next);
}

export async function signOutAction(): Promise<void> {
  await auth.signOut();
  redirect("/");
}

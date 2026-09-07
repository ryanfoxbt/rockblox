import { NextResponse } from "next/server";
import { getActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth/session";

// Signed-in only — a Super Powers perk (Spy feed + Explore live badges).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in for Super Powers" }, { status: 401 });
  return NextResponse.json(await getActivity());
}

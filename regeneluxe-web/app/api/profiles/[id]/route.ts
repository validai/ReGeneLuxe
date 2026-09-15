import { NextResponse } from "next/server";
import { requireOperator } from "../../../../server/auth/workspaceSession.js";
import {
  getManagedProfile,
  setActiveProfileForOperator,
  toPublicProfile,
  updateManagedProfile,
} from "../../../../server/db/managedProfileRepository.js";
import { setMeta } from "../../../../server/db/index.js";
import { publicOperator } from "../../../../src/data/profileModels.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const { id } = await params;
  const profile = await getManagedProfile(id);
  if (!result.ok || !profile || profile.ownerOperatorId !== result.operator.id) {
    return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, profile: toPublicProfile(profile) });
}

export async function PATCH(request: Request, { params }: Params) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const { id } = await params;
  const profile = await getManagedProfile(id);
  if (!profile || profile.ownerOperatorId !== result.operator.id) {
    return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const saved = await updateManagedProfile(id, body);
    return NextResponse.json({ ok: true, profile: toPublicProfile(saved) });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Could not update profile.",
    }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "activate") {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
  try {
    const operator = await setActiveProfileForOperator(result.operator.id, id);
    await setMeta("active_profile_id", id);
    const profile = await getManagedProfile(id);
    return NextResponse.json({
      ok: true,
      operator: publicOperator(operator),
      activeProfile: toPublicProfile(profile),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Could not switch profile.",
    }, { status: 400 });
  }
}

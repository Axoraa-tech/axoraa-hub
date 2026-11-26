// Publishes or schedules a post on the Facebook Page. Off unless Meta is configured AND
// META_PUBLISH_ENABLED is 'true'. Instagram and LinkedIn answer 400 'unsupported'. Image URLs are
// handed to Meta as-is; this server never downloads them.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth/dal";
import { CHANNEL_LIMITS, type PublishResult } from "@/lib/integrations/types";
import { IntegrationNotConfiguredError, MetaGraphError, UnsupportedOperationError } from "@/lib/integrations/errors";
import { readMetaConfig } from "@/lib/integrations/meta/config";
import { forgetPageToken } from "@/lib/integrations/meta/graph";
import { getChannels } from "@/lib/integrations/meta/registry";
import { INSTAGRAM_NOT_BUILT, LINKEDIN_NOT_BUILT } from "@/lib/integrations/meta/channels";

export const maxDuration = 60;

const MAX_BODY = 128 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

const httpsUrl = z
  .string()
  .max(2000)
  .refine((v) => {
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }, "Links must start with https://");

const imageUrl = httpsUrl.refine((v) => {
  try {
    return /\.(jpe?g|png)$/i.test(new URL(v).pathname);
  } catch {
    return false;
  }
}, "Images must be https links ending in .jpg, .jpeg or .png");

const Body = z.object({
  postId: z.string().trim().min(1).max(200),
  channel: z.enum(["facebook_page", "instagram", "linkedin"]),
  text: z.string().trim().min(1, "Write the post text first").max(CHANNEL_LIMITS.facebook_page.captionMax),
  link: httpsUrl.optional(),
  mediaUrls: z.array(imageUrl).max(10).optional(),
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return json({ error: "unauthorized" }, 401);
  if (!viewer.isAdmin && viewer.account.category !== "marketing") return json({ error: "forbidden" }, 403);

  const { config, missing } = readMetaConfig();
  if (!config) return json({ error: "not_configured", missing: viewer.isAdmin ? missing : [] }, 503);
  if (process.env.META_PUBLISH_ENABLED !== "true") return json({ error: "publish_disabled" }, 503);

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) return json({ error: "too_large" }, 413);
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json({ error: "bad_input" }, 400);
  }
  if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);

  let parsed: z.infer<typeof Body>;
  try {
    const result = Body.safeParse(JSON.parse(raw));
    if (!result.success) {
      return json({ error: "bad_input", message: result.error.issues[0]?.message ?? "Check the post and try again." }, 400);
    }
    parsed = result.data;
  } catch {
    return json({ error: "bad_input", message: "The request was not valid JSON." }, 400);
  }

  if (parsed.channel === "instagram") return json({ error: "unsupported", message: INSTAGRAM_NOT_BUILT }, 400);
  if (parsed.channel === "linkedin") return json({ error: "unsupported", message: LINKEDIN_NOT_BUILT }, 400);

  const channel = getChannels().facebook_page;
  const draft = { text: parsed.text, link: parsed.link, mediaUrls: parsed.mediaUrls };
  try {
    const result: PublishResult = parsed.scheduledAt
      ? await channel.schedule({ ...draft, scheduledAt: parsed.scheduledAt })
      : await channel.publish(draft);
    return json(result);
  } catch (err) {
    if (err instanceof UnsupportedOperationError) return json({ error: "unsupported", message: err.message }, 400);
    if (err instanceof IntegrationNotConfiguredError) return json({ error: "not_configured", missing: viewer.isAdmin ? err.missing : [] }, 503);
    if (err instanceof MetaGraphError) {
      if (err.tokenInvalid) forgetPageToken();
      return json({ error: err.message, code: err.code }, 502);
    }
    console.warn("Meta publish failed (unexpected error)");
    return json({ error: "Could not publish the post." }, 502);
  }
}

/** Latest TB Magic Book extension version + download URL, for the in-app
 * "업데이트 필요" banner on /story. The extension automates chatgpt.com, so it
 * can't go on the Chrome Web Store and is self-distributed (Load unpacked) —
 * there is no auto-update. This endpoint lets the app warn users running an
 * outdated build so they re-download and reload the folder.
 *
 * Ship a new build: bump the extension's manifest version, then set
 * EXT_LATEST_VERSION (and EXT_DOWNLOAD_URL) so the banner appears for everyone
 * still on the old build — no app redeploy needed. Falls back to the constants
 * below when the env vars are unset. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep in sync with tbbook-imagegen-ext/manifest.json when shipping without the
// env override.
const FALLBACK_VERSION = "0.1.1";

export async function GET() {
  const version = process.env.EXT_LATEST_VERSION || FALLBACK_VERSION;
  const downloadUrl = process.env.EXT_DOWNLOAD_URL || "";
  return Response.json({ version, downloadUrl });
}

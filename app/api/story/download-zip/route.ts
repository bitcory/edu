import { getServerUser } from "../../../lib/server-auth";
import { readStoryImage } from "../../../lib/pdf-storage";

/** Package selected story images into a ZIP (no dependency — STORE method, which
 * is fine since PNG/JPEG are already compressed). Reads bytes server-side from
 * R2 so there's no CORS hurdle. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const size = f.data.length;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 filename
    lh.writeUInt16LE(0, 8); // STORE
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(size, 18);
    lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    local.push(lh, name, f.data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(size, 20);
    ch.writeUInt32LE(size, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += lh.length + name.length + f.data.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBuf, eocd]);
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { items?: { key?: string; name?: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const items = (body.items || []).filter((it) => typeof it.key === "string" && it.key.startsWith("story/"));
  if (!items.length) return Response.json({ error: "이미지가 없어요." }, { status: 400 });

  const used = new Set<string>();
  const files: { name: string; data: Buffer }[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const data = await readStoryImage(it.key as string);
    if (!data) continue;
    const ext = ((it.key as string).split(".").pop() || "png").toLowerCase();
    const base = (it.name || `character_${i + 1}`).replace(/[^\w가-힣.-]+/g, "_").slice(0, 60) || `character_${i + 1}`;
    let name = `${base}.${ext}`;
    let n = 2;
    while (used.has(name)) name = `${base}_${n++}.${ext}`;
    used.add(name);
    files.push({ name, data });
  }
  if (!files.length) return Response.json({ error: "이미지를 읽지 못했어요." }, { status: 500 });

  const zip = buildZip(files);
  return new Response(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="characters.zip"',
    },
  });
}

import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { readAttachment } from "@/lib/services/files";

/** GET /api/files/:id — serves an uploaded file to users who can see its store. Supports byte
 * ranges, which phone browsers (iPhone Safari) need to play videos. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const { att, data } = await readAttachment(user, id);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const name = encodeURIComponent(att.fileName || "file");
    const headers: Record<string, string> = {
      "Content-Type": att.fileType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
    if (range && (range[1] || range[2])) {
      const size = data.length;
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(size - 1, end);
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
      }
      return new Response(new Uint8Array(data.subarray(start, end + 1)), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
      });
    }
    return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
  });
}

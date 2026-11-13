import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/dal";
import { readAttachment } from "@/lib/services/files";

/** GET /api/files/:id — serves an uploaded file to users who can see its store. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  return handle(async () => {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const { att, data } = await readAttachment(user, id);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const name = encodeURIComponent(att.fileName || "file");
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": att.fileType,
        "Content-Length": String(data.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}

"use client";

import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CommentItem {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string; role: string };
}

/** Spec: comment thread per module between the store owner and HQ. */
export function Comments({ moduleId, comments, currentUserId, canComment }: { moduleId: string; comments: CommentItem[]; currentUserId: string; canComment: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api(`/api/modules/${moduleId}/comments`, { body: { text } });
      setText("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not post the comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
      <ul className="space-y-2.5">
        {comments.map((c) => {
          const mine = c.user.id === currentUserId;
          return (
            <li key={c.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", mine ? "bg-primary/10" : "bg-muted")}>
                <p className="text-xs font-medium">
                  {c.user.name}
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {c.user.role === "STORE_OWNER" ? "Store owner" : c.user.role === "SUPER_ADMIN" ? "HQ" : "Regional Manager"} · {formatDateTime(c.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap">{c.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {canComment && (
        <form onSubmit={submit} className="flex items-end gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" rows={2} className="min-h-0" aria-label="Comment" maxLength={2000} />
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send comment">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      )}
    </div>
  );
}

"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client-api";

/** HQ approve / reject (reject requires a comment — spec). */
export function DecisionButtons({ moduleId, moduleName, size = "sm" }: { moduleId: string; moduleName: string; size?: "sm" | "default" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [open, setOpen] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function decide(kind: "approve" | "reject") {
    setBusy(kind);
    setError(null);
    try {
      await api(`/api/modules/${moduleId}/${kind}`, { body: { comment: comment.trim() || null } });
      toast.success(kind === "approve" ? `${moduleName} approved` : `${moduleName} sent back to the team`);
      setOpen(null);
      setComment("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={open === "approve"} onOpenChange={(o) => setOpen(o ? "approve" : null)}>
        <DialogTrigger asChild>
          <Button size={size} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <Check className="size-4" /> Approve
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {moduleName}?</DialogTitle>
            <DialogDescription>The team is notified. Approved steps are locked for editing, and the next steps can start.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`ac-${moduleId}`}>Comment (optional)</Label>
            <Textarea id={`ac-${moduleId}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={() => decide("approve")} disabled={busy !== null} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {busy === "approve" && <Loader2 className="size-4 animate-spin" />} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "reject"} onOpenChange={(o) => setOpen(o ? "reject" : null)}>
        <DialogTrigger asChild>
          <Button size={size} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
            <X className="size-4" /> Send back
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back {moduleName}</DialogTitle>
            <DialogDescription>The step goes back to In Progress and your comment is shown to the team that owns it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`rc-${moduleId}`}>What needs to change? (required)</Label>
            <Textarea id={`rc-${moduleId}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => decide("reject")} disabled={busy !== null || !comment.trim()}>
              {busy === "reject" && <Loader2 className="size-4 animate-spin" />} Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

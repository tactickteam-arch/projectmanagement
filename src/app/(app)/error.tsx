"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const notFound = /not found/i.test(error.message);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold">{notFound ? "Not found" : "Something went wrong"}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {notFound ? "This store or module does not exist, or you do not have access to it." : "The page could not be loaded. Please try again."}
        {error.digest && <span className="mt-1 block text-xs">Reference: {error.digest}</span>}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild><Link href="/">Go home</Link></Button>
      </div>
    </div>
  );
}

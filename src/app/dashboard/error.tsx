"use client";

import { Alert, Button } from "@/components/ui";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="error">
        This section could not be loaded.
        {error.digest ? <span className="block text-xs">Reference: {error.digest}</span> : null}
      </Alert>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}

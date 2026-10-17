"use client";

import ServiceError from "@/components/shared/ServiceError";

export default function NumerologyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ServiceError error={error} reset={reset} />;
}

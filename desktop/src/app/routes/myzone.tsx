import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { usePreviewFeatureWarning } from "@/shared/features";
import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

const MyZoneScreen = React.lazy(async () => {
  const module = await import("@/features/myzone/ui/MyZoneScreen");
  return { default: module.MyZoneScreen };
});

export const Route = createFileRoute("/myzone")({
  component: MyZoneRouteComponent,
});

function MyZoneRouteComponent() {
  usePreviewFeatureWarning("myzone");
  return (
    <React.Suspense
      fallback={<ViewLoadingFallback includeHeader kind="pulse" />}
    >
      <MyZoneScreen />
    </React.Suspense>
  );
}

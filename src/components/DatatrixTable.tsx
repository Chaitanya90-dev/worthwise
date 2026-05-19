import { lazy, Suspense, type ComponentType } from "react";
import type { DatatrixTableProps } from "./datatrix/DatatrixCore";

const DatatrixReadOnlyGrid = lazy(async () => {
  const module = await import("./datatrix/DatatrixReadOnlyGrid");
  return { default: module.DatatrixReadOnlyGrid as ComponentType<DatatrixTableProps<unknown>> };
});

const DatatrixSelectableGrid = lazy(async () => {
  const module = await import("./datatrix/DatatrixSelectableGrid");
  return { default: module.DatatrixSelectableGrid as ComponentType<DatatrixTableProps<unknown>> };
});

const DatatrixEditableGrid = lazy(async () => {
  const module = await import("./datatrix/DatatrixEditableGrid");
  return { default: module.DatatrixEditableGrid as ComponentType<DatatrixTableProps<unknown>> };
});

const tableLoadingFallback = (
  <div className="datatrix-root" style={{ minHeight: 220 }}>
    <div className="datatrix-table">
      <span className="muted">Loading table...</span>
    </div>
  </div>
);

export type { DatatrixTableProps } from "./datatrix/DatatrixCore";

export const DatatrixTable = <T,>(props: DatatrixTableProps<T>) => {
  const GridComponent = (
    props.onCellValueChanged
      ? DatatrixEditableGrid
      : props.enableSelection
      ? DatatrixSelectableGrid
      : DatatrixReadOnlyGrid
  ) as ComponentType<DatatrixTableProps<T>>;

  return (
    <Suspense fallback={tableLoadingFallback}>
      <GridComponent {...props} />
    </Suspense>
  );
};

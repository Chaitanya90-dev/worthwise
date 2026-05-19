import {
  _SharedRowSelectionModule,
  RowSelectionModule,
  type Module,
} from "ag-grid-community";
import { DatatrixCore } from "./DatatrixCore";
import type { DatatrixTableProps } from "./DatatrixCore";
import { datatrixReadOnlyModules } from "./DatatrixReadOnlyGrid";

const datatrixSelectionModules: Module[] = [
  ...datatrixReadOnlyModules,
  _SharedRowSelectionModule,
  RowSelectionModule,
];

export const DatatrixSelectableGrid = <T,>(props: DatatrixTableProps<T>) => (
  <DatatrixCore {...props} modules={datatrixSelectionModules} />
);

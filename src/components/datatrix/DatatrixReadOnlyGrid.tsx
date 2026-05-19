import {
  _ColumnMoveModule,
  _HorizontalResizeModule,
  _KeyboardNavigationModule,
  _PopupModule,
  _SortModule,
  CellStyleModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  RenderApiModule,
  RowStyleModule,
  type Module,
} from "ag-grid-community";
import { DatatrixCore } from "./DatatrixCore";
import type { DatatrixTableProps } from "./DatatrixCore";

export const datatrixReadOnlyModules: Module[] = [
  ClientSideRowModelModule,
  _ColumnMoveModule,
  _HorizontalResizeModule,
  _KeyboardNavigationModule,
  _PopupModule,
  ColumnApiModule,
  _SortModule,
  RenderApiModule,
  CellStyleModule,
  RowStyleModule,
];

export const DatatrixReadOnlyGrid = <T,>(props: DatatrixTableProps<T>) => (
  <DatatrixCore {...props} modules={datatrixReadOnlyModules} />
);

import {
  _EditCoreModule,
  TextEditorModule,
  type Module,
} from "ag-grid-community";
import { DatatrixCore } from "./DatatrixCore";
import type { DatatrixTableProps } from "./DatatrixCore";
import { datatrixReadOnlyModules } from "./DatatrixReadOnlyGrid";

const datatrixEditableModules: Module[] = [
  ...datatrixReadOnlyModules,
  _EditCoreModule,
  TextEditorModule,
];

export const DatatrixEditableGrid = <T,>(props: DatatrixTableProps<T>) => (
  <DatatrixCore {...props} modules={datatrixEditableModules} />
);

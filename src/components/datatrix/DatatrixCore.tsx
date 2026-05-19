import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  CellValueChangedEvent,
  ColDef,
  GridOptions,
  GridReadyEvent,
  Module,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "../../styles/datatrix.css";

const interactiveRowSelector = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='menu']",
  "[role='menuitem']",
  "[data-stop-row-click]",
  ".mantine-Button-root",
  ".mantine-ActionIcon-root",
  ".mantine-Menu-dropdown",
  ".mantine-Popover-dropdown",
].join(", ");

export type DatatrixTableProps<T> = {
  rows: T[];
  columns: ColDef<T>[];
  height?: number | string;
  loading?: boolean;
  emptyLabel?: string;
  rowHeight?: number;
  enableSelection?: boolean;
  getRowId?: (data: T) => string;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  onCellValueChanged?: (event: CellValueChangedEvent<T>) => void;
  onSelectionChanged?: (rows: T[]) => void;
  onGridReady?: (event: GridReadyEvent<T>) => void;
};

type DatatrixCoreProps<T> = DatatrixTableProps<T> & {
  modules: Module[];
};

export const DatatrixCore = <T,>({
  modules,
  rows,
  columns,
  height,
  loading = false,
  emptyLabel = "No data available",
  rowHeight = 44,
  enableSelection = false,
  getRowId,
  onRowClick,
  onRowDoubleClick,
  onCellValueChanged,
  onSelectionChanged,
  onGridReady,
}: DatatrixCoreProps<T>) => {
  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      sortable: true,
      resizable: true,
      flex: 1,
      minWidth: 120,
    }),
    []
  );

  const gridOptions = useMemo<GridOptions<T>>(
    () => ({
      theme: "legacy",
      animateRows: true,
      rowHeight,
      headerHeight: 42,
      suppressCellFocus: false,
      overlayNoRowsTemplate: `<span class="muted">${emptyLabel}</span>`,
      rowClass:
        onRowClick || onRowDoubleClick ? "datatrix-row-clickable" : undefined,
      rowSelection: enableSelection ? "multiple" : undefined,
      rowMultiSelectWithClick: enableSelection,
      suppressRowClickSelection: enableSelection,
    }),
    [emptyLabel, enableSelection, onRowClick, onRowDoubleClick, rowHeight]
  );

  const tableClassName = `ag-theme-alpine datatrix-table${
    loading ? " loading" : ""
  }`;

  return (
    <div className="datatrix-root" style={height ? { height } : undefined}>
      <div className={tableClassName}>
        <AgGridReact
          modules={modules}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          gridOptions={gridOptions}
          domLayout={height ? "normal" : "autoHeight"}
          suppressRowClickSelection={enableSelection}
          suppressCellFocus={false}
          overlayLoadingTemplate={
            loading ? "<span class='muted'>Loading...</span>" : undefined
          }
          getRowId={getRowId ? (params) => getRowId(params.data) : undefined}
          onRowClicked={
            onRowClick
              ? (event) => {
                  if (event.data) {
                    const target = event.event?.target as HTMLElement | null;
                    if (
                      target?.closest?.(".ag-selection-checkbox") ||
                      target?.closest?.(interactiveRowSelector)
                    ) {
                      return;
                    }
                    onRowClick(event.data);
                  }
                }
              : undefined
          }
          onRowDoubleClicked={
            onRowDoubleClick
              ? (event) => {
                  if (event.data) {
                    onRowDoubleClick(event.data);
                  }
                }
              : undefined
          }
          onCellValueChanged={onCellValueChanged}
          onSelectionChanged={
            onSelectionChanged
              ? (event) => {
                  const selected = event.api.getSelectedRows();
                  onSelectionChanged(selected as T[]);
                }
              : undefined
          }
          onGridReady={onGridReady}
        />
      </div>
    </div>
  );
};

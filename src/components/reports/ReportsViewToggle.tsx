import { SegmentedControl } from "@mantine/core";
import { BarChart3, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { appPath } from "../../app/paths";

type ReportsViewToggleProps = {
  value: "reports" | "cashflow";
};

export const ReportsViewToggle = ({ value }: ReportsViewToggleProps) => {
  const navigate = useNavigate();
  const handleChange = (next: string) => {
    if (next === "cashflow") {
      navigate(appPath("/cashflow"));
      return;
    }
    navigate(appPath("/reports"));
  };

  return (
    <SegmentedControl
      size="xs"
      value={value}
      onChange={handleChange}
      data={[
        {
          value: "reports",
          label: (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <BarChart3 size={14} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Reports</span>
            </span>
          ),
        },
        {
          value: "cashflow",
          label: (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <TrendingUp size={14} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Cashflow</span>
            </span>
          ),
        },
      ]}
    />
  );
};

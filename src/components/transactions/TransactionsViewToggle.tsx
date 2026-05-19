import { SegmentedControl } from "@mantine/core";
import { HandCoins, List } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { appPath } from "../../app/paths";

type TransactionsViewToggleProps = {
  value: "transactions" | "shared";
};

export const TransactionsViewToggle = ({
  value,
}: TransactionsViewToggleProps) => {
  const navigate = useNavigate();

  const handleChange = (next: string) => {
    if (next === "shared") {
      navigate(appPath("/shared-spend"));
      return;
    }
    navigate(appPath("/transactions"));
  };

  return (
    <SegmentedControl
      size="xs"
      value={value}
      onChange={handleChange}
      data={[
        {
          value: "transactions",
          label: (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <List size={14} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                Transactions
              </span>
            </span>
          ),
        },
        {
          value: "shared",
          label: (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <HandCoins size={14} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                Shared spend
              </span>
            </span>
          ),
        },
      ]}
    />
  );
};

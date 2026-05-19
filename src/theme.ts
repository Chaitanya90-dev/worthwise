import { createTheme } from "@mantine/core";
import type { MantineTheme } from "@mantine/core";

export const theme = createTheme({
  fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
  headings: {
    fontFamily: "Sora, IBM Plex Sans, sans-serif",
    fontWeight: "600",
  },
  shadows: {
    sm: "var(--shadow-soft)",
    md: "var(--shadow)",
  },
  colors: {
    brand: [
      "#e3f2fd",
      "#bbdefb",
      "#90caf9",
      "#64b5f6",
      "#42a5f5",
      "#2196f3",
      "#1e88e5",
      "#1976d2",
      "#1565c0",
      "#0d47a1",
    ],
  },
  primaryColor: "brand",
  defaultRadius: "md",
  radius: {
    xs: "6px",
    sm: "8px",
    md: "10px",
    lg: "12px",
    xl: "16px",
  },
  components: {
    InputWrapper: {
      styles: {
        label: {
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontSize: "11px",
          color: "var(--muted)",
          fontWeight: 600,
        },
        description: {
          color: "var(--muted)",
          fontSize: "12px",
        },
        error: {
          color: "var(--danger)",
          fontSize: "12px",
          fontWeight: 500,
        },
      },
    },
    Input: {
      styles: {
        input: {
          backgroundColor: "var(--surface)",
          borderColor: "var(--stroke)",
          color: "var(--ink)",
          fontSize: "14px",
          borderRadius: "10px",
          boxShadow: "none",
          "&::placeholder": {
            color: "var(--muted)",
          },
          "&:focus, &:focusWithin": {
            borderColor: "var(--accent)",
            boxShadow: "0 0 0 3px var(--accent-soft)",
          },
        },
      },
    },
    Button: {
      styles: (_theme: MantineTheme, params: { variant?: string }) => ({
        root: {
          fontWeight: 600,
          letterSpacing: "0.02em",
          borderRadius: "10px",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          ...(params.variant === "filled"
            ? { boxShadow: "0 10px 18px rgba(37, 99, 235, 0.22)" }
            : null),
        },
      }),
    },
    Paper: {
      styles: {
        root: {
          backgroundColor: "var(--surface)",
          borderColor: "var(--stroke)",
        },
      },
    },
    Badge: {
      styles: {
        root: {
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
          fontSize: "10px",
        },
      },
    },
    Checkbox: {
      styles: {
        label: {
          color: "var(--muted)",
        },
      },
    },
  },
});

export const chartPalette = {
  categorical: ["#0f4c5c", "#e57a44", "#ffbf69", "#1f8a70", "#f2c94c"],
  line: {
    primary: "#0f4c5c",
    accent: "#e57a44",
  },
  cashflow: {
    income: "#1f8a70",
    expense: "#e57a44",
    net: "#0f4c5c",
  },
};

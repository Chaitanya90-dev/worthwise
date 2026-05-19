import { describe, expect, it } from "vitest";
import { parsePdfStatementText } from "./pdfStatementParser";

const buildLookups = () => ({
  categoryByName: new Map<string, string>(),
  categoryById: new Map<string, string>(),
  paymentByName: new Map<string, string>([
    ["upi", "payment-upi"],
    ["bank transfer", "payment-bank"],
    ["card", "payment-card"],
  ]),
  paymentById: new Map<string, string>([
    ["payment-upi", "UPI"],
    ["payment-bank", "Bank Transfer"],
    ["payment-card", "Card"],
  ]),
  accountByName: new Map<string, string>([
    ["bob savings 9965", "account-bob"],
    ["hdfc savings 9965", "account-hdfc"],
    ["icici savings 3344", "account-icici"],
    ["sbi savings 7721", "account-sbi"],
    ["axis savings 1206", "account-axis"],
    ["one card 5113", "account-card"],
  ]),
  accountById: new Map<string, string>([
    ["account-bob", "BOB Savings 9965"],
    ["account-hdfc", "HDFC Savings 9965"],
    ["account-icici", "ICICI Savings 3344"],
    ["account-sbi", "SBI Savings 7721"],
    ["account-axis", "Axis Savings 1206"],
    ["account-card", "One Card 5113"],
  ]),
});

describe("pdfStatementParser", () => {
  it("parses generic account and card statement rows", () => {
    const text = `
      Bank of Baroda Statement Account XX9965
      Date Description Debit Credit Balance
      19/03/2026 UPI FROM TSUNA 3,752.00 CR 8,210.50
      18/03/2026 UPI TO VC CAFE 30.00 8,180.50
      11 Mar 2026 GOOGLE *YT 299.00 DR 7,881.50
    `;

    const result = parsePdfStatementText({
      text,
      defaults: {
        defaultType: "expense",
        defaultCategoryId: "",
        defaultPaymentId: "",
        defaultAccountId: "",
        recurring: false,
      },
      lookups: buildLookups(),
      rules: [],
    });

    expect(result.summary.total).toBe(3);
    expect(result.summary.parsed).toBe(3);
    expect(result.validRows).toHaveLength(3);
    expect(result.validRows.map((row) => row.data.type)).toEqual([
      "income",
      "expense",
      "expense",
    ]);
    expect(result.validRows.map((row) => row.data.amount)).toEqual([
      3752,
      30,
      299,
    ]);
    expect(result.validRows.map((row) => row.preview.payment)).toEqual([
      "UPI",
      "UPI",
      "Unspecified",
    ]);
    expect(result.metadata.accountHint).toBe("9965");
  });

  it("stitches wrapped statement descriptions and skips non-rows", () => {
    const text = `
      Statement for March 2026
      Opening balance 1,000.00
      10/03/2026 BOB Loan Recovery Fo.
      Loan payment first EMI 28,575.00 DR 42,220.00
      Page 1 of 2
    `;

    const result = parsePdfStatementText({
      text,
      defaults: {
        defaultType: "expense",
        defaultCategoryId: "",
        defaultPaymentId: "payment-bank",
        defaultAccountId: "",
        recurring: false,
      },
      lookups: buildLookups(),
      rules: [],
    });

    expect(result.summary.total).toBe(1);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].data.amount).toBe(28575);
    expect(result.validRows[0].preview.payment).toBe("Bank Transfer");
    expect(result.validRows[0].preview.merchant).toContain("BOB Loan Recovery");
  });

  it("parses HDFC and ICICI layouts with value dates and reference numbers", () => {
    const hdfcText = `
      HDFC BANK SAVINGS ACCOUNT STATEMENT
      Account Number : XX9965
      Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance
      20/03/26 UPI-TSUNA-9911223344 20/03/26 250.00 8,250.55
      19/03/26 NEFT CR ACME PAYROLL 19/03/26 0.00 80,000.00 88,250.55
    `;
    const iciciText = `
      ICICI Bank Statement Account Number XX3344
      Date Particulars Chq No. Withdrawals Deposits Balance
      20-Mar-2026 UPI/000112233445/BLUE TOKAI 20-Mar-2026 450.00 12,550.10
      19-Mar-2026 SALARY NEFT/ACME PAYROLL 0.00 65,000.00 77,550.10
    `;

    const hdfcResult = parsePdfStatementText({
      text: hdfcText,
      defaults: {
        defaultType: "expense",
        defaultCategoryId: "",
        defaultPaymentId: "",
        defaultAccountId: "",
        recurring: false,
      },
      lookups: buildLookups(),
      rules: [],
    });
    const iciciResult = parsePdfStatementText({
      text: iciciText,
      defaults: {
        defaultType: "expense",
        defaultCategoryId: "",
        defaultPaymentId: "",
        defaultAccountId: "",
        recurring: false,
      },
      lookups: buildLookups(),
      rules: [],
    });

    expect(hdfcResult.metadata.statementProfile).toBe("hdfc");
    expect(hdfcResult.validRows.map((row) => row.data.amount)).toEqual([
      250,
      80000,
    ]);
    expect(hdfcResult.validRows.map((row) => row.preview.payment)).toEqual([
      "UPI",
      "Bank Transfer",
    ]);
    expect(hdfcResult.validRows[0].preview.merchant).not.toContain("20/03/26");

    expect(iciciResult.metadata.statementProfile).toBe("icici");
    expect(iciciResult.validRows.map((row) => row.data.amount)).toEqual([
      450,
      65000,
    ]);
    expect(iciciResult.validRows.map((row) => row.preview.payment)).toEqual([
      "UPI",
      "Bank Transfer",
    ]);
    expect(iciciResult.validRows[0].preview.merchant).not.toContain(
      "20-Mar-2026",
    );
  });

  it("parses SBI and Axis account statement tables", () => {
    const sbiText = `
      State Bank of India Account Statement A/C No XX7721
      Txn Date Value Date Description Ref No./Cheque No. Debit Credit Balance
      20 Mar 2026 TO TRANSFER-INB UPI/GOOGLEPAY/9876543210 20 Mar 2026 1,950.00 48,500.50
      19 Mar 2026 BY TRANSFER-NEFT SALARY 0.00 45,000.00 50,450.50
    `;
    const axisText = `
      Axis Bank Statement Account No. XX1206
      Tran Date Chq No Particulars Debit(Dr) Credit(Cr) Balance
      20-03-2026 POS/IRCTC/123456 1,245.00 45,880.10
      19-03-2026 IMPS/EMPLOYER/ACME CORP 0.00 55,000.00 47,125.10
    `;

    const sbiResult = parsePdfStatementText({
      text: sbiText,
      defaults: {
        defaultType: "expense",
        defaultCategoryId: "",
        defaultPaymentId: "",
        defaultAccountId: "",
        recurring: false,
      },
      lookups: buildLookups(),
      rules: [],
    });
    const axisResult = parsePdfStatementText({
      text: axisText,
      defaults: {
        defaultType: "expense",
        defaultCategoryId: "",
        defaultPaymentId: "",
        defaultAccountId: "",
        recurring: false,
      },
      lookups: buildLookups(),
      rules: [],
    });

    expect(sbiResult.metadata.statementProfile).toBe("sbi");
    expect(sbiResult.validRows.map((row) => row.data.amount)).toEqual([
      1950,
      45000,
    ]);
    expect(sbiResult.validRows.map((row) => row.preview.payment)).toEqual([
      "UPI",
      "Bank Transfer",
    ]);

    expect(axisResult.metadata.statementProfile).toBe("axis");
    expect(axisResult.validRows.map((row) => row.data.amount)).toEqual([
      1245,
      55000,
    ]);
    expect(axisResult.validRows.map((row) => row.preview.payment)).toEqual([
      "Card",
      "Bank Transfer",
    ]);
  });

  it("parses Amex card statements with short month-first dates", () => {
    const text = `
      American Express Credit Card Statement Card ending 5113
      Date of Charge Description of Charge Amount
      Mar 19 AMAZON PAY INDIA 1,299.00
      Mar 18 CASHBACK STATEMENT CREDIT -199.00
    `;

    const result = parsePdfStatementText({
      text,
      defaults: {
        defaultType: "expense",
        defaultCategoryId: "",
        defaultPaymentId: "",
        defaultAccountId: "",
        recurring: false,
      },
      lookups: buildLookups(),
      rules: [],
    });

    expect(result.metadata.statementProfile).toBe("amex");
    expect(result.metadata.accountHint).toBe("5113");
    expect(result.validRows.map((row) => row.data.date)).toEqual([
      "2026-03-19",
      "2026-03-18",
    ]);
    expect(result.validRows.map((row) => row.data.type)).toEqual([
      "expense",
      "income",
    ]);
    expect(result.validRows.map((row) => row.preview.payment)).toEqual([
      "Card",
      "Card",
    ]);
    expect(result.validRows.map((row) => row.data.amount)).toEqual([
      1299,
      199,
    ]);
  });
});

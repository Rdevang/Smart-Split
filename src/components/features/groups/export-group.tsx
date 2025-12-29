"use client";

import { useState, useRef, useEffect } from "react";
import {
    Download,
    FileSpreadsheet,
    FileText,
    FileType,
    Loader2,
    ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/currency";

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string | null;
    expense_date: string | null;
    paid_by: string | null;
    paid_by_profile?: {
        id: string;
        full_name: string | null;
    } | null;
    paid_by_placeholder?: {
        id: string;
        name: string;
    } | null;
    splits?: Array<{
        user_id: string | null;
        placeholder_id?: string | null;
        amount: number;
        profile?: { full_name: string | null } | null;
        placeholder?: { name: string } | null;
    }>;
}

interface Balance {
    user_id: string;
    user_name: string;
    balance: number;
}

interface ExportGroupProps {
    groupName: string;
    expenses: Expense[];
    balances: Balance[];
    currency: string;
    totalSpent: number;
}

type ExportFormat = "csv" | "sheets" | "notion" | "pdf";

export function ExportGroup({
    groupName,
    expenses,
    balances,
    currency,
    totalSpent,
}: ExportGroupProps) {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [exporting, setExporting] = useState<ExportFormat | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getPaidByName = (expense: Expense): string => {
        return expense.paid_by_profile?.full_name || expense.paid_by_placeholder?.name || "Unknown";
    };

    const generateCSVContent = (): string => {
        const headers = ["Date", "Description", "Category", "Amount", "Paid By", "Split With"];
        const rows = expenses.map((e) => {
            const splitWith = e.splits
                ?.map((s) => s.profile?.full_name || s.placeholder?.name || "Unknown")
                .join("; ") || "";
            return [
                e.expense_date || "",
                `"${e.description.replace(/"/g, '""')}"`,
                e.category || "other",
                e.amount.toFixed(2),
                getPaidByName(e),
                `"${splitWith}"`,
            ].join(",");
        });

        // Add summary section
        const summary = [
            "",
            "--- SUMMARY ---",
            `Total Spent,${totalSpent.toFixed(2)}`,
            `Total Expenses,${expenses.length}`,
            "",
            "--- BALANCES ---",
            ...balances.map((b) => `${b.user_name},${b.balance >= 0 ? "+" : ""}${b.balance.toFixed(2)}`),
        ];

        return [headers.join(","), ...rows, ...summary].join("\n");
    };

    const handleExportCSV = () => {
        setExporting("csv");
        try {
            const csv = generateCSVContent();
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${groupName.replace(/[^a-z0-9]/gi, "_")}_expenses.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast({
                title: "Exported!",
                message: "CSV file downloaded successfully",
                variant: "success",
            });
        } catch {
            toast({
                title: "Export failed",
                message: "Could not generate CSV file",
                variant: "error",
            });
        } finally {
            setExporting(null);
            setIsOpen(false);
        }
    };

    const handleExportSheets = async () => {
        setExporting("sheets");
        try {
            // Generate tab-separated values (pastes better into Sheets)
            const tsv = generateTSVContent();
            await navigator.clipboard.writeText(tsv);

            toast({
                title: "Copied to clipboard!",
                message: "Paste into Google Sheets (Ctrl/Cmd + V)",
                variant: "success",
            });

            // Open Google Sheets in new tab
            setTimeout(() => {
                window.open("https://sheets.google.com/create", "_blank");
            }, 300);
        } catch {
            toast({
                title: "Export failed",
                message: "Could not copy to clipboard",
                variant: "error",
            });
        } finally {
            setExporting(null);
            setIsOpen(false);
        }
    };

    const generateTSVContent = (): string => {
        const headers = ["Date", "Description", "Category", "Amount", "Paid By", "Split With"];
        const rows = expenses.map((e) => {
            const splitWith = e.splits
                ?.map((s) => s.profile?.full_name || s.placeholder?.name || "Unknown")
                .join(", ") || "";
            return [
                e.expense_date || "",
                e.description,
                e.category || "other",
                e.amount.toFixed(2),
                getPaidByName(e),
                splitWith,
            ].join("\t");
        });

        // Add summary section
        const summary = [
            "",
            "SUMMARY",
            `Total Spent\t${totalSpent.toFixed(2)}`,
            `Total Expenses\t${expenses.length}`,
            "",
            "BALANCES",
            ...balances.map((b) => `${b.user_name}\t${b.balance >= 0 ? "+" : ""}${b.balance.toFixed(2)}`),
        ];

        return [headers.join("\t"), ...rows, ...summary].join("\n");
    };

    const handleExportNotion = () => {
        setExporting("notion");
        try {
            // Generate markdown table for Notion
            const markdown = generateNotionMarkdown();
            navigator.clipboard.writeText(markdown);

            toast({
                title: "Copied to clipboard!",
                message: "Paste into Notion (Ctrl/Cmd + V)",
                variant: "success",
            });

            // Open new Notion page
            setTimeout(() => {
                window.open("https://www.notion.so/new", "_blank");
            }, 300);
        } catch {
            toast({
                title: "Export failed",
                message: "Could not copy to clipboard",
                variant: "error",
            });
        } finally {
            setExporting(null);
            setIsOpen(false);
        }
    };

    const generateNotionMarkdown = (): string => {
        const lines = [
            `# ${groupName} - Expense Report`,
            "",
            `**Total Spent:** ${formatCurrency(totalSpent, currency)}`,
            `**Total Expenses:** ${expenses.length}`,
            "",
            "## Expenses",
            "",
            "| Date | Description | Category | Amount | Paid By |",
            "|------|-------------|----------|--------|---------|",
            ...expenses.map((e) =>
                `| ${e.expense_date || "-"} | ${e.description} | ${e.category || "other"} | ${formatCurrency(e.amount, currency)} | ${getPaidByName(e)} |`
            ),
            "",
            "## Balances",
            "",
            "| Member | Balance |",
            "|--------|---------|",
            ...balances.map((b) =>
                `| ${b.user_name} | ${b.balance >= 0 ? "+" : ""}${formatCurrency(b.balance, currency)} |`
            ),
        ];
        return lines.join("\n");
    };

    const handleExportPDF = () => {
        setExporting("pdf");
        try {
            // Create a printable HTML document
            const printWindow = window.open("", "_blank");
            if (!printWindow) {
                toast({
                    title: "Popup blocked",
                    message: "Please allow popups to export PDF",
                    variant: "error",
                });
                setExporting(null);
                return;
            }

            const html = generatePDFHTML();
            printWindow.document.write(html);
            printWindow.document.close();

            // Wait for styles to load then print
            printWindow.onload = () => {
                printWindow.print();
            };

            toast({
                title: "PDF Ready",
                message: "Use Print dialog to save as PDF",
                variant: "success",
            });
        } catch {
            toast({
                title: "Export failed",
                message: "Could not generate PDF",
                variant: "error",
            });
        } finally {
            setExporting(null);
            setIsOpen(false);
        }
    };

    const generatePDFHTML = (): string => {
        const expenseRows = expenses
            .map(
                (e) => `
                <tr>
                    <td>${e.expense_date || "-"}</td>
                    <td>${e.description}</td>
                    <td><span class="category">${e.category || "other"}</span></td>
                    <td class="amount">${formatCurrency(e.amount, currency)}</td>
                    <td>${getPaidByName(e)}</td>
                </tr>
            `
            )
            .join("");

        const balanceRows = balances
            .map(
                (b) => `
                <tr>
                    <td>${b.user_name}</td>
                    <td class="${b.balance >= 0 ? "positive" : "negative"}">
                        ${b.balance >= 0 ? "+" : ""}${formatCurrency(b.balance, currency)}
                    </td>
                </tr>
            `
            )
            .join("");

        return `
<!DOCTYPE html>
<html>
<head>
    <title>${groupName} - Expense Report</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            color: #1f2937;
            line-height: 1.5;
        }
        h1 { 
            font-size: 28px; 
            margin-bottom: 8px;
            color: #0d9488;
        }
        .subtitle {
            color: #6b7280;
            margin-bottom: 32px;
        }
        .summary {
            display: flex;
            gap: 24px;
            margin-bottom: 32px;
        }
        .summary-card {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 16px 24px;
        }
        .summary-card .label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .summary-card .value {
            font-size: 24px;
            font-weight: 700;
            color: #0d9488;
        }
        h2 {
            font-size: 18px;
            margin: 24px 0 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        th {
            text-align: left;
            padding: 12px;
            background: #f9fafb;
            border-bottom: 2px solid #e5e7eb;
            font-weight: 600;
            color: #374151;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .amount { font-weight: 600; }
        .category {
            display: inline-block;
            padding: 2px 8px;
            background: #e0f2fe;
            color: #0369a1;
            border-radius: 4px;
            font-size: 12px;
        }
        .positive { color: #059669; font-weight: 600; }
        .negative { color: #dc2626; font-weight: 600; }
        .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #9ca3af;
            text-align: center;
        }
        @media print {
            body { padding: 20px; }
            .summary-card { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <h1>${groupName}</h1>
    <p class="subtitle">Expense Report • Generated on ${new Date().toLocaleDateString()}</p>
    
    <div class="summary">
        <div class="summary-card">
            <div class="label">Total Spent</div>
            <div class="value">${formatCurrency(totalSpent, currency)}</div>
        </div>
        <div class="summary-card">
            <div class="label">Expenses</div>
            <div class="value">${expenses.length}</div>
        </div>
        <div class="summary-card">
            <div class="label">Members</div>
            <div class="value">${balances.length}</div>
        </div>
    </div>

    <h2>All Expenses</h2>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Paid By</th>
            </tr>
        </thead>
        <tbody>
            ${expenseRows}
        </tbody>
    </table>

    <h2>Settlement Balances</h2>
    <table>
        <thead>
            <tr>
                <th>Member</th>
                <th>Balance</th>
            </tr>
        </thead>
        <tbody>
            ${balanceRows}
        </tbody>
    </table>

    <div class="footer">
        Generated by Smart Split • ${new Date().toLocaleString()}
    </div>
</body>
</html>
        `;
    };

    const exportOptions = [
        {
            id: "csv" as const,
            label: "CSV File",
            description: "Excel, Numbers compatible",
            icon: FileSpreadsheet,
            action: handleExportCSV,
        },
        {
            id: "sheets" as const,
            label: "Google Sheets",
            description: "Copy & paste into Sheets",
            icon: FileSpreadsheet,
            action: handleExportSheets,
            hasExternal: true,
        },
        {
            id: "notion" as const,
            label: "Notion",
            description: "Copies markdown table",
            icon: FileText,
            action: handleExportNotion,
            hasExternal: true,
        },
        {
            id: "pdf" as const,
            label: "PDF Summary",
            description: "Printable report",
            icon: FileType,
            action: handleExportPDF,
        },
    ];

    return (
        <div className="relative" ref={dropdownRef}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="gap-2"
            >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
            </Button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-800 z-50">
                    <p className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                        Export to
                    </p>
                    {exportOptions.map((option) => (
                        <button
                            key={option.id}
                            onClick={option.action}
                            disabled={exporting !== null}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                                {exporting === option.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                                ) : (
                                    <option.icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {option.label}
                                    </span>
                                    {option.hasExternal && (
                                        <ExternalLink className="h-3 w-3 text-gray-400" />
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {option.description}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}


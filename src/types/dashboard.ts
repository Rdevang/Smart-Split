export interface Profile {
    full_name: string | null;
    currency: string | null;
}

export interface Group {
    id: string;
    name: string;
    description: string | null;
    category: string;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    expense_date: string;
    paid_by?: string;
}

export interface ExpenseSplit {
    amount: number;
    user_id: string;
    is_settled: boolean;
    expense: {
        paid_by: string;
    } | {
        paid_by: string;
    }[];
}

export interface RecentExpense {
    id: string;
    description: string;
    amount: number;
    expense_date: string;
}

export interface User {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
}

export interface AuthState {
    user: User | null;
    isLoading: boolean;
    error: string | null;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials extends LoginCredentials {
    full_name: string;
    confirm_password: string;
}


import { getCsrfToken } from "@/lib/csrf";

/**
 * Hidden CSRF token input for forms
 * 
 * This is a Server Component that fetches the CSRF token server-side
 * and renders a hidden input field.
 * 
 * @example
 * ```tsx
 * <form>
 *     <CsrfInput />
 *     <input name="email" />
 *     <button type="submit">Submit</button>
 * </form>
 * ```
 */
export async function CsrfInput() {
    const token = await getCsrfToken();
    
    return (
        <input
            type="hidden"
            name="csrf_token"
            value={token}
            // Add data attribute for debugging in development
            data-testid="csrf-token"
        />
    );
}


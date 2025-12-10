import { cn } from "@/lib/utils";

describe("cn utility", () => {
    it("merges class names", () => {
        expect(cn("class-a", "class-b")).toBe("class-a class-b");
    });

    it("handles conditional classes with clsx", () => {
        expect(cn("base", { active: true, disabled: false })).toBe("base active");
    });

    it("handles arrays of classes", () => {
        expect(cn(["class-a", "class-b"])).toBe("class-a class-b");
    });

    it("handles undefined and null values", () => {
        expect(cn("base", undefined, null, "extra")).toBe("base extra");
    });

    it("handles empty strings", () => {
        expect(cn("base", "", "extra")).toBe("base extra");
    });

    it("merges Tailwind conflicting classes correctly", () => {
        // tailwind-merge should keep the last conflicting class
        expect(cn("p-4", "p-2")).toBe("p-2");
        expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
    });

    it("handles complex Tailwind class merging", () => {
        expect(cn("px-4 py-2", "px-2")).toBe("py-2 px-2");
        expect(cn("text-sm text-gray-500", "text-lg")).toBe("text-gray-500 text-lg");
    });

    it("preserves non-conflicting classes", () => {
        expect(cn("p-4", "m-2")).toBe("p-4 m-2");
        expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white");
    });

    it("handles responsive variants", () => {
        expect(cn("p-4", "md:p-6", "lg:p-8")).toBe("p-4 md:p-6 lg:p-8");
    });

    it("handles hover and focus states", () => {
        expect(cn("bg-blue-500", "hover:bg-blue-600")).toBe("bg-blue-500 hover:bg-blue-600");
    });

    it("merges conflicting responsive classes", () => {
        expect(cn("md:p-4", "md:p-6")).toBe("md:p-6");
    });

    it("handles dark mode classes", () => {
        expect(cn("bg-white", "dark:bg-gray-900")).toBe("bg-white dark:bg-gray-900");
    });
});


import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Smart Split - Split Expenses with Friends";
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = "image/png";

export default async function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: "100%",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    backgroundColor: "#0f172a",
                    padding: "80px",
                }}
            >
                {/* Background decoration */}
                <div
                    style={{
                        position: "absolute",
                        top: "-100px",
                        right: "-100px",
                        width: "400px",
                        height: "400px",
                        borderRadius: "50%",
                        background: "rgba(20, 184, 166, 0.15)",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: "-50px",
                        left: "-50px",
                        width: "300px",
                        height: "300px",
                        borderRadius: "50%",
                        background: "rgba(20, 184, 166, 0.1)",
                    }}
                />

                {/* Logo and title */}
                <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                    {/* Logo icon */}
                    <div
                        style={{
                            width: "80px",
                            height: "80px",
                            borderRadius: "20px",
                            background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "36px",
                        }}
                    >
                        💰
                    </div>
                    <div
                        style={{
                            fontSize: "64px",
                            fontWeight: 800,
                            color: "white",
                            display: "flex",
                        }}
                    >
                        Smart
                        <span style={{ color: "#14b8a6" }}>Split</span>
                    </div>
                </div>

                {/* Tagline */}
                <div
                    style={{
                        fontSize: "32px",
                        color: "#94a3b8",
                        marginTop: "24px",
                    }}
                >
                    Split expenses, not friendships
                </div>

                {/* Features */}
                <div
                    style={{
                        display: "flex",
                        gap: "40px",
                        marginTop: "60px",
                    }}
                >
                    {["Track group expenses", "Simplify debts", "Settle up instantly"].map(
                        (feature) => (
                            <div
                                key={feature}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    color: "#64748b",
                                    fontSize: "20px",
                                }}
                            >
                                <div
                                    style={{
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        backgroundColor: "#14b8a6",
                                    }}
                                />
                                {feature}
                            </div>
                        )
                    )}
                </div>

                {/* URL */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "60px",
                        left: "80px",
                        fontSize: "24px",
                        color: "#475569",
                    }}
                >
                    smart-split-one.vercel.app
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}


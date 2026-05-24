"use client";

import React from "react";

// ─── Reusable Admin UI Components ───

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{title}</h1>
      {subtitle && <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "0.25rem" }}>{subtitle}</p>}
    </div>
  );
}

export function StatCard({ label, value, sub, color = "#3b82f6", icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(30, 41, 59, 0.6)",
      border: "1px solid rgba(148, 163, 184, 0.08)",
      borderRadius: "0.75rem",
      padding: "1.25rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 500 }}>{label}</span>
        {icon && <span style={{ color, opacity: 0.7, width: 20, height: 20 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f1f5f9" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{sub}</div>}
    </div>
  );
}

export function DataTable({ columns, rows, emptyMsg = "Aucune donnée." }: {
  columns: { key: string; label: string; width?: string }[];
  rows: Record<string, React.ReactNode>[];
  emptyMsg?: string;
}) {
  return (
    <div style={{
      background: "rgba(30, 41, 59, 0.6)",
      border: "1px solid rgba(148, 163, 184, 0.08)",
      borderRadius: "0.75rem",
      overflow: "hidden",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.1)" }}>
            {columns.map((col) => (
              <th key={col.key} style={{
                textAlign: "left", padding: "0.75rem 1rem",
                color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem",
                textTransform: "uppercase", letterSpacing: "0.05em",
                width: col.width,
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: "2rem 1rem", textAlign: "center", color: "#64748b" }}>
                {emptyMsg}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.05)" }}>
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: "0.65rem 1rem", color: "#e2e8f0" }}>
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ text, variant = "default" }: {
  text: string; variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const colors = {
    default: { bg: "rgba(148, 163, 184, 0.1)", border: "rgba(148, 163, 184, 0.2)", text: "#94a3b8" },
    success: { bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)", text: "#4ade80" },
    warning: { bg: "rgba(234, 179, 8, 0.1)", border: "rgba(234, 179, 8, 0.2)", text: "#facc15" },
    danger: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)", text: "#f87171" },
    info: { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.2)", text: "#60a5fa" },
  };
  const c = colors[variant];
  return (
    <span style={{
      display: "inline-block", padding: "0.15rem 0.5rem",
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: "9999px", fontSize: "0.72rem", fontWeight: 600, color: c.text,
    }}>
      {text}
    </span>
  );
}

export function InfoBox({ text, variant = "info" }: { text: string; variant?: "info" | "warning" }) {
  const isWarning = variant === "warning";
  return (
    <div style={{
      padding: "0.75rem 1rem",
      background: isWarning ? "rgba(234, 179, 8, 0.08)" : "rgba(59, 130, 246, 0.08)",
      border: `1px solid ${isWarning ? "rgba(234, 179, 8, 0.2)" : "rgba(59, 130, 246, 0.2)"}`,
      borderRadius: "0.5rem",
      fontSize: "0.82rem",
      color: isWarning ? "#facc15" : "#60a5fa",
      marginBottom: "1rem",
    }}>
      {text}
    </div>
  );
}

export function Grid({ children, cols = 4 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: "1rem",
      marginBottom: "1.5rem",
    }}>
      {children}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.75rem" }}>{title}</h2>
      {children}
    </div>
  );
}

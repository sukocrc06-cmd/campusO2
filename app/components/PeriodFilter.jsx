"use client";

export default function PeriodFilter({
  periods,
  activePeriod,
  selectedId,
  onChange,
  includeAll = true,
  title = "Dönem filtresi",
}) {
  return (
    <section
      aria-label={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 14,
        marginBottom: 18,
        padding: "15px 17px",
        border: "1px solid #c7deff",
        borderRadius: 15,
        background: "linear-gradient(135deg, #f1f7ff, #fff)",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <small style={{ color: "#175cd3", fontSize: 10, fontWeight: 820, letterSpacing: ".12em" }}>AKTİF DÖNEM</small>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <strong style={{ fontSize: 14 }}>{activePeriod?.label || "Dönem seçilmedi"}</strong>
          <span style={{ padding: "4px 8px", borderRadius: 999, color: activePeriod?.isOpen ? "#0b6b4b" : "#984333", background: activePeriod?.isOpen ? "#e6f8f0" : "#fff0ec", fontSize: 10, fontWeight: 760 }}>
            {activePeriod?.isOpen ? "İşlemlere açık" : "Kapalı"}
          </span>
        </div>
      </div>
      <label style={{ display: "grid", gap: 5, color: "#5b6b85", fontSize: 11, fontWeight: 720 }}>
        Görüntülenen dönem
        <select value={selectedId} onChange={(event) => onChange(event.target.value)} style={{ minWidth: 190, height: 40, padding: "0 10px", border: "1px solid #e3ebf6", borderRadius: 10, color: "#0f1b33", background: "#fff" }}>
          {includeAll && <option value="all">Tüm dönemler</option>}
          {periods.map((period) => (
            <option key={period.id} value={period.id}>{period.label}{period.isActive ? " · Aktif" : ""}</option>
          ))}
        </select>
      </label>
    </section>
  );
}

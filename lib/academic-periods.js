export const FALLBACK_PERIOD = {
  id: "period-2026-2027-guz",
  academicYear: "2026-2027",
  term: "guz",
  label: "2026-2027 Güz",
  startDate: "2026-09-01",
  endDate: "2027-01-31",
  isActive: true,
  isOpen: true,
};

export async function loadPeriodContext() {
  try {
    const response = await fetchWithAuth("/api/qr", { cache: "no-store" });
    if (!response.ok) throw new Error("PERIOD_API_UNAVAILABLE");
    const store = await response.json();
    const periods = Array.isArray(store.periods) && store.periods.length
      ? store.periods
      : [FALLBACK_PERIOD];
    const activePeriod = periods.find((period) => period.id === store.activePeriodId)
      || periods.find((period) => period.isActive)
      || periods[0];
    return { periods, activePeriod, source: "server" };
  } catch {
    return { periods: [FALLBACK_PERIOD], activePeriod: FALLBACK_PERIOD, source: "fallback" };
  }
}

export function periodLabel(period) {
  return period?.label || "Dönem bilgisi yok";
}

export function inferPeriodFromDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month >= 9) {
    return { academicYear: `${year}-${year + 1}`, term: "guz" };
  }
  if (month <= 5) {
    return { academicYear: `${year - 1}-${year}`, term: "bahar" };
  }
  return { academicYear: `${year - 1}-${year}`, term: "yaz" };
}

export function recordMatchesPeriod(record, period) {
  if (!period || period.id === "all") return true;
  if (record?.period_id) return record.period_id === period.id;
  if (record?.academic_year && record?.academic_term) {
    return record.academic_year === period.academicYear && record.academic_term === period.term;
  }
  const inferred = inferPeriodFromDate(record?.baslangic_tarihi || record?.created_at);
  return inferred?.academicYear === period.academicYear && inferred?.term === period.term;
}

export function findRecordPeriod(record, periods) {
  return periods.find((period) => recordMatchesPeriod(record, period)) || null;
}

export function periodSelectOptions(periods, includeAll = true) {
  const options = periods.map((period) => ({ value: period.id, label: period.label }));
  return includeAll ? [{ value: "all", label: "Tüm dönemler" }, ...options] : options;
}
import { fetchWithAuth } from "./supabase";

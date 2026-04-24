import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppColors } from "../../constants/colors";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface Props {
  visible: boolean;
  value: Date | null;
  onConfirm: (date: Date) => void;
  onClose: () => void;
  colors: AppColors;
  disableFuture?: boolean;
}

export function DatePickerModal({ visible, value, onConfirm, onClose, colors, disableFuture = false }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => (value ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (value ?? today).getMonth());
  const [selected, setSelected] = useState<Date | null>(value);

  useEffect(() => {
    if (visible) {
      const ref = value ?? today;
      setViewYear(ref.getFullYear());
      setViewMonth(ref.getMonth());
      setSelected(value);
    }
  }, [visible]);

  const navigateMonth = (dir: -1 | 1) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
  };

  const canGoNext = !disableFuture || (
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth())
  );

  const isFutureDay = (d: number) => {
    if (!disableFuture) return false;
    const date = new Date(viewYear, viewMonth, d);
    date.setHours(0, 0, 0, 0);
    const t = new Date(today);
    t.setHours(0, 0, 0, 0);
    return date > t;
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isSel = (d: number) =>
    !!selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === d;

  const isTod = (d: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === d;

  const handleDay = (d: number | null) => {
    if (!d || isFutureDay(d)) return;
    const date = new Date(viewYear, viewMonth, d);
    setSelected(date);
    onConfirm(date);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[s.container, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <View style={s.calHeader}>
            <TouchableOpacity onPress={() => navigateMonth(-1)} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[s.monthTitle, { color: colors.textPrimary }]}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth(1)} style={s.navBtn} disabled={!canGoNext}>
              <Ionicons name="chevron-forward" size={20} color={canGoNext ? colors.textPrimary : colors.border} />
            </TouchableOpacity>
          </View>

          <View style={s.dayRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={[s.dayLabel, { color: colors.textMuted }]}>{d}</Text>
            ))}
          </View>

          <View style={s.grid}>
            {cells.map((d, i) => {
              const disabled = !d || isFutureDay(d);
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.cell, d && isSel(d) && { backgroundColor: colors.primary, borderRadius: 20 }]}
                  onPress={() => handleDay(d)}
                  disabled={disabled}
                >
                  {d ? (
                    <>
                      <Text style={[
                        s.cellText,
                        {
                          color: disabled
                            ? colors.border
                            : isSel(d) ? "#fff"
                            : isTod(d) ? colors.primary
                            : colors.textPrimary,
                        },
                      ]}>
                        {d}
                      </Text>
                      {isTod(d) && !isSel(d) && (
                        <View style={[s.todayDot, { backgroundColor: colors.primary }]} />
                      )}
                    </>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[s.cancelBtn, { borderTopColor: colors.border }]} onPress={onClose}>
            <Text style={[s.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  container: { width: "100%", borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  calHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 16,
  },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  monthTitle: { fontSize: 16, fontWeight: "700" },
  dayRow: { flexDirection: "row", paddingHorizontal: 8, marginBottom: 4 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingBottom: 8 },
  cell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  cellText: { fontSize: 14, fontWeight: "500" },
  todayDot: { width: 4, height: 4, borderRadius: 2, position: "absolute", bottom: 4 },
  cancelBtn: { borderTopWidth: 1, paddingVertical: 14, alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontWeight: "600" },
});

import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { BODY_GROUPS, BodyGroupKey } from "@/src/data/exercise-muscle-groups";
import { colors, radius } from "@/src/theme";

type Props = {
  selected: BodyGroupKey[];
  onToggle: (group: BodyGroupKey) => void;
  onClear: () => void;
};

const inactive = "#4A4947";
const inactiveSoft = "#29292B";
const selectedFill = colors.yellow;

function fill(selected: BodyGroupKey[], group: BodyGroupKey) {
  return selected.includes(group) ? selectedFill : inactive;
}

function NeutralBody({
  back,
  selected,
  onToggle,
}: {
  back?: boolean;
  selected: BodyGroupKey[];
  onToggle: (group: BodyGroupKey) => void;
}) {
  const cx = back ? 224 : 96;

  return (
    <G>
      <Circle cx={cx} cy={37} r={17} fill={inactiveSoft} stroke={inactive} strokeWidth={2} />
      <Rect x={cx - 7} y={53} width={14} height={12} rx={6} fill={inactiveSoft} />

      <Path
        d={`M ${cx - 34} 69 Q ${cx} 55 ${cx + 34} 69 L ${cx + 26} 142 Q ${cx} 154 ${cx - 26} 142 Z`}
        fill={inactiveSoft}
        stroke={inactive}
        strokeWidth={2}
      />
      <Path onPress={() => onToggle("arms")} d={`M ${cx - 34} 72 L ${cx - 48} 135`} stroke={fill(selected, "arms")} strokeWidth={18} strokeLinecap="round" />
      <Path onPress={() => onToggle("arms")} d={`M ${cx + 34} 72 L ${cx + 48} 135`} stroke={fill(selected, "arms")} strokeWidth={18} strokeLinecap="round" />
      <Circle onPress={() => onToggle("shoulders")} cx={cx - 31} cy={74} r={14} fill={fill(selected, "shoulders")} />
      <Circle onPress={() => onToggle("shoulders")} cx={cx + 31} cy={74} r={14} fill={fill(selected, "shoulders")} />

      {back ? (
        <>
          <Path onPress={() => onToggle("back")} d={`M ${cx - 23} 78 Q ${cx} 68 ${cx + 23} 78 L ${cx + 18} 112 Q ${cx} 124 ${cx - 18} 112 Z`} fill={fill(selected, "back")} />
          <Rect onPress={() => onToggle("lower_back")} x={cx - 17} y={113} width={34} height={25} rx={10} fill={fill(selected, "lower_back")} />
          <Ellipse onPress={() => onToggle("glutes")} cx={cx - 13} cy={149} rx={17} ry={14} fill={fill(selected, "glutes")} />
          <Ellipse onPress={() => onToggle("glutes")} cx={cx + 13} cy={149} rx={17} ry={14} fill={fill(selected, "glutes")} />
        </>
      ) : (
        <>
          <Path onPress={() => onToggle("chest")} d={`M ${cx - 25} 79 Q ${cx} 65 ${cx + 25} 79 L ${cx + 20} 103 Q ${cx} 111 ${cx - 20} 103 Z`} fill={fill(selected, "chest")} />
          <Rect onPress={() => onToggle("core")} x={cx - 18} y={106} width={36} height={35} rx={12} fill={fill(selected, "core")} />
        </>
      )}

      <Path onPress={() => onToggle(back ? "hamstrings" : "quads")} d={`M ${cx - 15} 160 L ${cx - 25} 221`} stroke={fill(selected, back ? "hamstrings" : "quads")} strokeWidth={24} strokeLinecap="round" />
      <Path onPress={() => onToggle(back ? "hamstrings" : "quads")} d={`M ${cx + 15} 160 L ${cx + 25} 221`} stroke={fill(selected, back ? "hamstrings" : "quads")} strokeWidth={24} strokeLinecap="round" />
      <Path onPress={() => onToggle("calves")} d={`M ${cx - 25} 222 L ${cx - 29} 262`} stroke={fill(selected, "calves")} strokeWidth={18} strokeLinecap="round" />
      <Path onPress={() => onToggle("calves")} d={`M ${cx + 25} 222 L ${cx + 29} 262`} stroke={fill(selected, "calves")} strokeWidth={18} strokeLinecap="round" />
    </G>
  );
}

export function MuscleBodyFilter({ selected, onToggle, onClear }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>ZONES TRAVAILLÉES</Text>
          <Text style={styles.helper}>Appuie sur le corps ou sélectionne une ou plusieurs zones.</Text>
        </View>
        {!!selected.length && (
          <Pressable onPress={onClear} accessibilityRole="button" style={styles.clearButton}>
            <Text style={styles.clearText}>Effacer</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.bodyMap}>
        <View style={styles.bodyLabelRow} pointerEvents="none">
          <Text style={styles.bodyLabel}>FACE</Text>
          <Text style={styles.bodyLabel}>DOS</Text>
        </View>
        <Svg viewBox="0 0 320 280" width="100%" height={252} accessibilityLabel="Corps humain neutre, face et dos">
          <NeutralBody selected={selected} onToggle={onToggle} />
          <NeutralBody back selected={selected} onToggle={onToggle} />
        </Svg>
      </View>

      <View style={styles.chips}>
        {BODY_GROUPS.map((group) => {
          const isSelected = selected.includes(group.key);
          const cardio = group.key === "cardio";
          return (
            <Pressable
              key={group.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onToggle(group.key)}
              style={({ pressed }) => [
                styles.chip,
                cardio && styles.cardioChip,
                isSelected && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {cardio ? "♥  " : ""}{group.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(11,11,12,0.94)",
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.yellow, fontSize: 11, fontWeight: "900", letterSpacing: 1.8 },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  clearButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.surface3 },
  clearText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  bodyMap: { position: "relative", alignSelf: "center", width: "100%", maxWidth: 360, backgroundColor: "rgba(255,255,255,0.018)", borderRadius: radius.md, overflow: "hidden" },
  bodyLabelRow: { position: "absolute", zIndex: 1, top: 9, left: 0, right: 0, flexDirection: "row", justifyContent: "space-around" },
  bodyLabel: { color: colors.muted2, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { minHeight: 38, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.surface2 },
  cardioChip: { borderColor: "rgba(240,68,68,0.45)" },
  chipActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.13)" },
  chipPressed: { opacity: 0.7 },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  chipTextActive: { color: colors.yellow },
});

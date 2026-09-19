import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Ellipse, G, Path } from "react-native-svg";
import { BODY_GROUPS, BodyGroupKey } from "@/src/data/exercise-muscle-groups";
import { colors, radius } from "@/src/theme";

type Props = {
  selected: BodyGroupKey[];
  onToggle: (group: BodyGroupKey) => void;
  onClear: () => void;
};

const bodyFill = "#17191C";
const bodyStroke = "#555A60";
const muscleFill = "#30343A";
const muscleStroke = "#6A7179";
const selectedFill = colors.yellow;
const selectedStroke = "#FFE39A";

function zoneStyle(selected: BodyGroupKey[], group: BodyGroupKey) {
  const active = selected.includes(group);
  return {
    fill: active ? selectedFill : muscleFill,
    stroke: active ? selectedStroke : muscleStroke,
    strokeWidth: active ? 1.6 : 1.05,
  };
}

function FrontBody({ selected, onToggle }: { selected: BodyGroupKey[]; onToggle: (group: BodyGroupKey) => void }) {
  const shoulders = zoneStyle(selected, "shoulders");
  const chest = zoneStyle(selected, "chest");
  const arms = zoneStyle(selected, "arms");
  const core = zoneStyle(selected, "core");
  const quads = zoneStyle(selected, "quads");
  const calves = zoneStyle(selected, "calves");

  return (
    <G transform="translate(91 13)">
      <Ellipse cx={0} cy={22} rx={15} ry={19} fill={bodyFill} stroke={bodyStroke} strokeWidth={1.3} />
      <Path d="M-8 39 L-7 54 L-20 63 L20 63 L7 54 L8 39 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.2} />
      <Path d="M-20 59 C-30 60 -38 63 -45 69 L-35 96 L-29 137 L-20 162 L20 162 L29 137 L35 96 L45 69 C38 63 30 60 20 59 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.4} />
      <Path d="M-21 155 L-29 174 L-22 184 L22 184 L29 174 L21 155 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.3} />

      <Ellipse onPress={() => onToggle("shoulders")} cx={-39} cy={75} rx={12} ry={15} rotation={18} origin="-39 75" {...shoulders} />
      <Ellipse onPress={() => onToggle("shoulders")} cx={39} cy={75} rx={12} ry={15} rotation={-18} origin="39 75" {...shoulders} />

      <G onPress={() => onToggle("arms")} {...arms}>
        <Path d="M-47 82 C-54 96 -54 114 -50 129 L-39 128 L-34 92 Z" />
        <Path d="M47 82 C54 96 54 114 50 129 L39 128 L34 92 Z" />
        <Path d="M-50 129 C-55 147 -61 164 -61 180 L-51 183 L-38 132 Z" />
        <Path d="M50 129 C55 147 61 164 61 180 L51 183 L38 132 Z" />
      </G>
      <Path d="M-61 178 L-66 190 L-60 199 L-53 188 L-50 181 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />
      <Path d="M61 178 L66 190 L60 199 L53 188 L50 181 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />

      <G onPress={() => onToggle("chest")} {...chest}>
        <Path d="M-5 66 C-13 62 -27 64 -32 72 L-29 94 C-20 99 -10 98 -4 91 Z" />
        <Path d="M5 66 C13 62 27 64 32 72 L29 94 C20 99 10 98 4 91 Z" />
      </G>

      <G onPress={() => onToggle("core")} {...core}>
        <Path d="M-5 96 L-18 99 L-17 114 L-5 114 Z" />
        <Path d="M5 96 L18 99 L17 114 L5 114 Z" />
        <Path d="M-5 115 L-17 116 L-15 132 L-5 132 Z" />
        <Path d="M5 115 L17 116 L15 132 L5 132 Z" />
        <Path d="M-5 133 L-14 134 L-11 151 L-4 156 Z" />
        <Path d="M5 133 L14 134 L11 151 L4 156 Z" />
        <Path d="M-19 99 C-27 110 -25 139 -13 151 L-15 118 Z" />
        <Path d="M19 99 C27 110 25 139 13 151 L15 118 Z" />
      </G>

      <G onPress={() => onToggle("quads")} {...quads}>
        <Path d="M-22 181 C-34 196 -34 227 -27 248 L-16 243 L-7 186 Z" />
        <Path d="M-7 186 L-15 244 L-8 253 L-1 244 L-1 187 Z" />
        <Path d="M22 181 C34 196 34 227 27 248 L16 243 L7 186 Z" />
        <Path d="M7 186 L15 244 L8 253 L1 244 L1 187 Z" />
      </G>
      <Path d="M-26 248 L-18 255 L-8 253 L-9 262 L-23 262 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />
      <Path d="M26 248 L18 255 L8 253 L9 262 L23 262 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />

      <G onPress={() => onToggle("calves")} {...calves}>
        <Path d="M-24 263 C-31 277 -29 297 -21 306 L-13 295 L-12 264 Z" />
        <Path d="M24 263 C31 277 29 297 21 306 L13 295 L12 264 Z" />
        <Path d="M-12 264 L-13 295 L-18 313 L-8 313 L-3 269 Z" />
        <Path d="M12 264 L13 295 L18 313 L8 313 L3 269 Z" />
      </G>
      <Path d="M-18 311 L-19 321 L-32 327 L-4 327 L-7 312 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />
      <Path d="M18 311 L19 321 L32 327 L4 327 L7 312 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />
    </G>
  );
}

function BackBody({ selected, onToggle }: { selected: BodyGroupKey[]; onToggle: (group: BodyGroupKey) => void }) {
  const shoulders = zoneStyle(selected, "shoulders");
  const back = zoneStyle(selected, "back");
  const arms = zoneStyle(selected, "arms");
  const lowerBack = zoneStyle(selected, "lower_back");
  const glutes = zoneStyle(selected, "glutes");
  const hamstrings = zoneStyle(selected, "hamstrings");
  const calves = zoneStyle(selected, "calves");

  return (
    <G transform="translate(269 13)">
      <Ellipse cx={0} cy={22} rx={15} ry={19} fill={bodyFill} stroke={bodyStroke} strokeWidth={1.3} />
      <Path d="M-8 39 L-7 54 L-20 63 L20 63 L7 54 L8 39 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.2} />
      <Path d="M-20 59 C-30 60 -38 63 -45 69 L-35 96 L-29 137 L-20 162 L20 162 L29 137 L35 96 L45 69 C38 63 30 60 20 59 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.4} />
      <Path d="M-21 155 L-29 174 L-22 184 L22 184 L29 174 L21 155 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.3} />

      <Ellipse onPress={() => onToggle("shoulders")} cx={-39} cy={75} rx={12} ry={15} rotation={18} origin="-39 75" {...shoulders} />
      <Ellipse onPress={() => onToggle("shoulders")} cx={39} cy={75} rx={12} ry={15} rotation={-18} origin="39 75" {...shoulders} />

      <G onPress={() => onToggle("arms")} {...arms}>
        <Path d="M-47 82 C-54 96 -54 114 -50 129 L-39 128 L-34 92 Z" />
        <Path d="M47 82 C54 96 54 114 50 129 L39 128 L34 92 Z" />
        <Path d="M-50 129 C-55 147 -61 164 -61 180 L-51 183 L-38 132 Z" />
        <Path d="M50 129 C55 147 61 164 61 180 L51 183 L38 132 Z" />
      </G>
      <Path d="M-61 178 L-66 190 L-60 199 L-53 188 L-50 181 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />
      <Path d="M61 178 L66 190 L60 199 L53 188 L50 181 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />

      <G onPress={() => onToggle("back")} {...back}>
        <Path d="M-5 54 L-28 66 L-22 89 L-5 105 Z" />
        <Path d="M5 54 L28 66 L22 89 L5 105 Z" />
        <Path d="M-22 90 C-31 99 -29 132 -15 143 L-5 108 Z" />
        <Path d="M22 90 C31 99 29 132 15 143 L5 108 Z" />
      </G>

      <G onPress={() => onToggle("lower_back")} {...lowerBack}>
        <Path d="M-5 107 L-15 145 L-10 158 L-2 151 Z" />
        <Path d="M5 107 L15 145 L10 158 L2 151 Z" />
      </G>

      <G onPress={() => onToggle("glutes")} {...glutes}>
        <Path d="M-2 158 C-11 152 -25 159 -27 172 C-26 183 -15 188 -2 181 Z" />
        <Path d="M2 158 C11 152 25 159 27 172 C26 183 15 188 2 181 Z" />
      </G>

      <G onPress={() => onToggle("hamstrings")} {...hamstrings}>
        <Path d="M-24 184 C-32 202 -30 232 -22 251 L-11 243 L-5 185 Z" />
        <Path d="M-5 185 L-10 244 L-4 253 L-1 244 L-1 185 Z" />
        <Path d="M24 184 C32 202 30 232 22 251 L11 243 L5 185 Z" />
        <Path d="M5 185 L10 244 L4 253 L1 244 L1 185 Z" />
      </G>
      <Path d="M-22 250 L-13 255 L-4 253 L-8 262 L-22 262 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />
      <Path d="M22 250 L13 255 L4 253 L8 262 L22 262 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />

      <G onPress={() => onToggle("calves")} {...calves}>
        <Path d="M-21 263 C-29 274 -29 297 -20 307 L-11 297 L-9 265 Z" />
        <Path d="M21 263 C29 274 29 297 20 307 L11 297 L9 265 Z" />
        <Path d="M-9 265 L-11 297 L-17 313 L-7 313 L-3 269 Z" />
        <Path d="M9 265 L11 297 L17 313 L7 313 L3 269 Z" />
      </G>
      <Path d="M-17 311 L-18 321 L-31 327 L-4 327 L-7 312 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />
      <Path d="M17 311 L18 321 L31 327 L4 327 L7 312 Z" fill={bodyFill} stroke={bodyStroke} strokeWidth={1.1} />
    </G>
  );
}

export function MuscleBodyFilter({ selected, onToggle, onClear }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>ZONES TRAVAILLÉES</Text>
          <Text style={styles.helper}>Appuie directement sur un muscle ou sélectionne plusieurs zones.</Text>
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
        <Svg viewBox="0 0 360 352" width="100%" height={316} accessibilityLabel="Anatomie musculaire neutre, face et dos">
          <FrontBody selected={selected} onToggle={onToggle} />
          <BackBody selected={selected} onToggle={onToggle} />
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendSwatch} />
        <Text style={styles.legendText}>Muscles sélectionnés</Text>
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
              style={({ pressed }) => [styles.chip, cardio && styles.cardioChip, isSelected && styles.chipActive, pressed && styles.chipPressed]}
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
  card: { marginHorizontal: 20, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: "rgba(11,11,12,0.94)", borderRadius: radius.lg, padding: 16, gap: 12 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.yellow, fontSize: 11, fontWeight: "900", letterSpacing: 1.8 },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  clearButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.surface3 },
  clearText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  bodyMap: { position: "relative", alignSelf: "center", width: "100%", maxWidth: 390, backgroundColor: "rgba(255,255,255,0.018)", borderWidth: 1, borderColor: "rgba(255,255,255,0.035)", borderRadius: radius.md, overflow: "hidden" },
  bodyLabelRow: { position: "absolute", zIndex: 1, top: 9, left: 0, right: 0, flexDirection: "row", justifyContent: "space-around" },
  bodyLabel: { color: colors.muted2, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  legend: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  legendSwatch: { width: 9, height: 9, borderRadius: 3, backgroundColor: colors.yellow, borderWidth: 1, borderColor: selectedStroke },
  legendText: { color: colors.muted2, fontSize: 10, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { minHeight: 38, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.surface2 },
  cardioChip: { borderColor: "rgba(240,68,68,0.45)" },
  chipActive: { borderColor: colors.yellow, backgroundColor: "rgba(255,196,0,0.13)" },
  chipPressed: { opacity: 0.7 },
  chipText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  chipTextActive: { color: colors.yellow },
});

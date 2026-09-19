import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Ellipse, G, Image as SvgImage, Path } from "react-native-svg";
import { BODY_GROUPS, BodyGroupKey } from "@/src/data/exercise-muscle-groups";
import { colors, radius } from "@/src/theme";

type Props = {
  selected: BodyGroupKey[];
  onToggle: (group: BodyGroupKey) => void;
  onClear: () => void;
};

const anatomyImage = require("../../assets/anatomy-selector.png");
const selectedStroke = "#FFE39A";

function highlight(selected: BodyGroupKey[], group: BodyGroupKey) {
  const active = selected.includes(group);
  return {
    fill: active ? colors.yellow : "#000000",
    fillOpacity: active ? 0.68 : 0.001,
    stroke: active ? selectedStroke : "transparent",
    strokeWidth: active ? 4 : 0,
  };
}

function FrontHighlights({ selected, onToggle }: { selected: BodyGroupKey[]; onToggle: (group: BodyGroupKey) => void }) {
  return (
    <G>
      <G onPress={() => onToggle("shoulders")} {...highlight(selected, "shoulders")}>
        <Ellipse cx={270} cy={283} rx={57} ry={67} rotation={24} origin="270 283" />
        <Ellipse cx={507} cy={283} rx={57} ry={67} rotation={-24} origin="507 283" />
      </G>

      <G onPress={() => onToggle("chest")} {...highlight(selected, "chest")}>
        <Path d="M382 248 C344 230 300 246 290 282 C291 329 328 360 382 348 Z" />
        <Path d="M390 248 C428 230 472 246 482 282 C481 329 444 360 390 348 Z" />
      </G>

      <G onPress={() => onToggle("arms")} {...highlight(selected, "arms")}>
        <Path d="M253 337 C221 363 211 415 225 456 C246 468 269 447 275 397 L286 338 Z" />
        <Path d="M520 337 C552 363 562 415 548 456 C527 468 504 447 498 397 L487 338 Z" />
        <Path d="M225 454 C199 483 184 542 187 584 C206 600 229 585 241 547 L259 466 Z" />
        <Path d="M548 454 C574 483 589 542 586 584 C567 600 544 585 532 547 L514 466 Z" />
      </G>

      <G onPress={() => onToggle("core")} {...highlight(selected, "core")}>
        <Path d="M337 351 C319 385 318 475 334 549 L382 590 L382 356 Z" />
        <Path d="M435 351 C453 385 454 475 438 549 L390 590 L390 356 Z" />
      </G>

      <G onPress={() => onToggle("quads")} {...highlight(selected, "quads")}>
        <Path d="M310 585 C268 642 270 738 306 797 C344 792 367 726 373 620 L363 580 Z" />
        <Path d="M463 585 C505 642 503 738 467 797 C429 792 406 726 400 620 L410 580 Z" />
      </G>

      <G onPress={() => onToggle("calves")} {...highlight(selected, "calves")}>
        <Path d="M302 808 C270 851 282 960 318 1004 C348 965 358 876 333 813 Z" />
        <Path d="M471 808 C503 851 491 960 455 1004 C425 965 415 876 440 813 Z" />
      </G>
    </G>
  );
}

function BackHighlights({ selected, onToggle }: { selected: BodyGroupKey[]; onToggle: (group: BodyGroupKey) => void }) {
  return (
    <G>
      <G onPress={() => onToggle("shoulders")} {...highlight(selected, "shoulders")}>
        <Ellipse cx={875} cy={284} rx={57} ry={68} rotation={24} origin="875 284" />
        <Ellipse cx={1115} cy={284} rx={57} ry={68} rotation={-24} origin="1115 284" />
      </G>

      <G onPress={() => onToggle("back")} {...highlight(selected, "back")}>
        <Path d="M990 166 C941 209 898 247 901 329 C921 382 946 447 989 505 Z" />
        <Path d="M998 166 C1047 209 1090 247 1087 329 C1067 382 1042 447 999 505 Z" />
        <Path d="M989 334 C954 369 929 438 941 518 L989 568 Z" />
        <Path d="M999 334 C1034 369 1059 438 1047 518 L999 568 Z" />
      </G>

      <G onPress={() => onToggle("arms")} {...highlight(selected, "arms")}>
        <Path d="M858 341 C827 373 822 420 838 463 C861 473 882 443 887 395 L893 340 Z" />
        <Path d="M1131 341 C1162 373 1167 420 1151 463 C1128 473 1107 443 1102 395 L1096 340 Z" />
        <Path d="M838 458 C812 494 796 547 801 587 C820 603 842 584 853 545 L871 470 Z" />
        <Path d="M1151 458 C1177 494 1193 547 1188 587 C1169 603 1147 584 1136 545 L1118 470 Z" />
      </G>

      <G onPress={() => onToggle("lower_back")} {...highlight(selected, "lower_back")}>
        <Path d="M989 486 C963 512 946 550 949 591 L989 622 Z" />
        <Path d="M999 486 C1025 512 1042 550 1039 591 L999 622 Z" />
      </G>

      <G onPress={() => onToggle("glutes")} {...highlight(selected, "glutes")}>
        <Path d="M989 576 C943 560 914 596 923 660 C944 685 972 680 989 652 Z" />
        <Path d="M999 576 C1045 560 1074 596 1065 660 C1044 685 1016 680 999 652 Z" />
      </G>

      <G onPress={() => onToggle("hamstrings")} {...highlight(selected, "hamstrings")}>
        <Path d="M931 661 C899 706 909 785 949 817 C977 783 984 710 972 657 Z" />
        <Path d="M1057 661 C1089 706 1079 785 1039 817 C1011 783 1004 710 1016 657 Z" />
      </G>

      <G onPress={() => onToggle("calves")} {...highlight(selected, "calves")}>
        <Path d="M940 812 C910 858 919 965 954 1004 C986 962 992 868 968 816 Z" />
        <Path d="M1048 812 C1078 858 1069 965 1034 1004 C1002 962 996 868 1020 816 Z" />
      </G>
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
        <Svg viewBox="0 0 1374 1145" width="100%" height={286} accessibilityLabel="Anatomie musculaire détaillée, face et dos">
          <SvgImage href={anatomyImage} width={1374} height={1145} preserveAspectRatio="xMidYMid meet" />
          <FrontHighlights selected={selected} onToggle={onToggle} />
          <BackHighlights selected={selected} onToggle={onToggle} />
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
  bodyMap: { position: "relative", alignSelf: "center", width: "100%", maxWidth: 390, backgroundColor: "#08090A", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", borderRadius: radius.md, overflow: "hidden" },
  bodyLabelRow: { position: "absolute", zIndex: 1, top: 8, left: 0, right: 0, flexDirection: "row", justifyContent: "space-around" },
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

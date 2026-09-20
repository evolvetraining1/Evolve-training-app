import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Image as SvgImage, Path } from "react-native-svg";
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
    fillOpacity: active ? 0.56 : 0.001,
    stroke: active ? selectedStroke : "transparent",
    strokeWidth: active ? 2.6 : 0,
  };
}

function FrontHighlights({ selected, onToggle }: { selected: BodyGroupKey[]; onToggle: (group: BodyGroupKey) => void }) {
  return (
    <G>
      <G onPress={() => onToggle("shoulders")} {...highlight(selected, "shoulders")}>
        <Path d="M304 225 C267 219 235 242 232 281 C232 312 247 332 277 341 C285 315 295 281 314 251 Z" />
        <Path d="M468 225 C505 219 537 242 540 281 C540 312 525 332 495 341 C487 315 477 281 458 251 Z" />
      </G>

      <G onPress={() => onToggle("chest")} {...highlight(selected, "chest")}>
        <Path d="M385 247 C356 237 316 236 300 250 C291 268 294 310 311 329 C333 343 365 339 385 315 Z" />
        <Path d="M387 247 C416 237 456 236 472 250 C481 268 478 310 461 329 C439 343 407 339 387 315 Z" />
      </G>

      <G onPress={() => onToggle("arms")} {...highlight(selected, "arms")}>
        <Path d="M276 311 C248 315 225 340 222 369 C219 391 225 407 243 410 C261 399 273 371 282 329 Z" />
        <Path d="M496 311 C524 315 547 340 550 369 C553 391 547 407 529 410 C511 399 499 371 490 329 Z" />
        <Path d="M243 407 C218 417 193 455 179 515 L212 531 C226 499 244 456 257 416 Z" />
        <Path d="M529 407 C554 417 579 455 593 515 L560 531 C546 499 528 456 515 416 Z" />
      </G>

      <G onPress={() => onToggle("core")} {...highlight(selected, "core")}>
        <Path d="M385 335 C351 337 319 341 305 371 C303 423 326 496 385 553 Z" />
        <Path d="M387 335 C421 337 453 341 467 371 C469 423 446 496 387 553 Z" />
      </G>

      <G onPress={() => onToggle("quads")} {...highlight(selected, "quads")}>
        <Path d="M303 548 C276 568 267 618 274 674 C278 705 290 732 311 740 C333 724 351 678 365 590 L356 557 Z" />
        <Path d="M469 548 C496 568 505 618 498 674 C494 705 482 732 461 740 C439 724 421 678 407 590 L416 557 Z" />
      </G>

      <G onPress={() => onToggle("calves")} {...highlight(selected, "calves")}>
        <Path d="M305 751 C278 776 266 820 269 865 C272 895 283 921 303 932 C325 915 340 879 341 831 C340 790 327 761 305 751 Z" />
        <Path d="M467 751 C494 776 506 820 503 865 C500 895 489 921 469 932 C447 915 432 879 431 831 C432 790 445 761 467 751 Z" />
      </G>
    </G>
  );
}

function BackHighlights({ selected, onToggle }: { selected: BodyGroupKey[]; onToggle: (group: BodyGroupKey) => void }) {
  return (
    <G>
      <G onPress={() => onToggle("shoulders")} {...highlight(selected, "shoulders")}>
        <Path d="M910 225 C873 219 841 243 838 282 C839 313 855 333 884 342 C892 315 902 281 922 251 Z" />
        <Path d="M1070 225 C1107 219 1139 243 1142 282 C1141 313 1125 333 1096 342 C1088 315 1078 281 1058 251 Z" />
      </G>

      <G onPress={() => onToggle("back")} {...highlight(selected, "back")}>
        <Path d="M989 187 C958 208 925 226 893 238 C883 270 890 307 906 338 C919 379 929 431 943 462 C958 480 974 491 989 500 Z" />
        <Path d="M991 187 C1022 208 1055 226 1087 238 C1097 270 1090 307 1074 338 C1061 379 1051 431 1037 462 C1022 480 1006 491 991 500 Z" />
        <Path d="M906 337 C925 350 951 379 989 416 L989 500 C959 476 940 449 929 411 Z" />
        <Path d="M1074 337 C1055 350 1029 379 991 416 L991 500 C1021 476 1040 449 1051 411 Z" />
      </G>

      <G onPress={() => onToggle("arms")} {...highlight(selected, "arms")}>
        <Path d="M882 312 C854 317 831 342 828 371 C825 393 832 408 849 412 C867 400 879 371 887 329 Z" />
        <Path d="M1098 312 C1126 317 1149 342 1152 371 C1155 393 1148 408 1131 412 C1113 400 1101 371 1093 329 Z" />
        <Path d="M849 408 C824 419 799 457 786 516 L818 532 C833 500 851 457 863 417 Z" />
        <Path d="M1131 408 C1156 419 1181 457 1194 516 L1162 532 C1147 500 1129 457 1117 417 Z" />
      </G>

      <G onPress={() => onToggle("lower_back")} {...highlight(selected, "lower_back")}>
        <Path d="M989 398 L942 452 C930 472 926 499 928 523 L968 526 L989 496 Z" />
        <Path d="M991 398 L1038 452 C1050 472 1054 499 1052 523 L1012 526 L991 496 Z" />
      </G>

      <G onPress={() => onToggle("glutes")} {...highlight(selected, "glutes")}>
        <Path d="M989 486 C962 480 929 487 912 509 C902 533 902 566 912 591 C936 606 969 601 989 580 Z" />
        <Path d="M991 486 C1018 480 1051 487 1068 509 C1078 533 1078 566 1068 591 C1044 606 1011 601 991 580 Z" />
      </G>

      <G onPress={() => onToggle("hamstrings")} {...highlight(selected, "hamstrings")}>
        <Path d="M917 590 C882 613 867 658 871 703 C875 731 888 754 910 762 C938 741 961 694 975 607 L961 590 Z" />
        <Path d="M1063 590 C1098 613 1113 658 1109 703 C1105 731 1092 754 1070 762 C1042 741 1019 694 1005 607 L1019 590 Z" />
      </G>

      <G onPress={() => onToggle("calves")} {...highlight(selected, "calves")}>
        <Path d="M897 760 C871 785 858 832 864 875 C868 903 881 923 899 927 C920 910 937 874 941 827 C939 791 923 769 897 760 Z" />
        <Path d="M1083 760 C1109 785 1122 832 1116 875 C1112 903 1099 923 1081 927 C1060 910 1043 874 1039 827 C1041 791 1057 769 1083 760 Z" />
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

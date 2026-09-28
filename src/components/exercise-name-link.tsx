import { Link } from "expo-router";
import { Keyboard, Text, type TextProps } from "react-native";

type ExerciseNameLinkProps = Pick<TextProps, "children" | "style"> & {
  exerciseId?: string | null;
  name?: string | null;
  disabled?: boolean;
};

/** Push the library sheet without replacing or restarting the workout below it. */
export function ExerciseNameLink({ exerciseId, name, disabled, children, style }: ExerciseNameLinkProps) {
  if (!exerciseId || disabled) return <Text style={style}>{children}</Text>;

  return (
    <Link
      push
      href={{ pathname: "/exercise/[id]", params: { id: exerciseId } }}
      onPress={() => Keyboard.dismiss()}
      accessibilityRole="link"
      accessibilityLabel={`Voir la fiche : ${name || "exercice"}`}
      accessibilityHint="Le bouton retour revient à la séance en cours."
      style={style}
    >
      {children}
    </Link>
  );
}

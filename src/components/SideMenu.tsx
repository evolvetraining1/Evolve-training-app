import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { colors } from "@/src/theme";

type Props = { visible: boolean; onClose: () => void; role?: string };

const sections = [
  { title: "COACHING", items: [
    { icon: "▣", label: "Mes programmes", route: "/(tabs)/training" },
    { icon: "✉", label: "Messagerie", route: "/messaging" },
    { icon: "☷", label: "Journal & routine", route: "/(tabs)/journal" },
  ]},
  { title: "OUTILS", items: [
    { icon: "1", label: "Calculateur 1RM", route: "/rm-calculator" },
    { icon: "◎", label: "Suivi nutrition", route: "/nutrition" },
    { icon: "↗", label: "Performances", route: "/(tabs)/stats" },
  ]},
  { title: "COMPTE", items: [
    { icon: "＋", label: "Programmes achetés", badge: "OFFRES" },
    { icon: "●", label: "Profil & réglages", route: "/(tabs)/profile" },
  ]},
];

export default function SideMenu({ visible, onClose, role }: Props) {
  const open = (route?: string) => {
    if (!route) return;
    onClose();
    router.push(route as any);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.drawer}>
          <View style={styles.head}>
            <View>
              <Text style={styles.brand}>EVOLVE</Text>
              <Text style={styles.training}>TRAINING</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <Text style={styles.access}>{role === "coach" ? "ACCÈS COACH" : "MON ESPACE"}</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {sections.map(section => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.items.map(item => (
                  <Pressable key={item.label} onPress={() => open(item.route)} style={styles.item}>
                    <View style={styles.itemIcon}><Text style={styles.itemIconText}>{item.icon}</Text></View>
                    <Text style={styles.itemText}>{item.label}</Text>
                    {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : <Text style={styles.chev}>›</Text>}
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,.68)" },
  drawer: { width: "82%", maxWidth: 340, height: "100%", backgroundColor: "#09090A", borderRightWidth: 1, borderRightColor: colors.border, paddingTop: 58, paddingHorizontal: 20 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  brand: { color: colors.text, fontWeight: "900", fontSize: 25, letterSpacing: 7 },
  training: { color: colors.text, fontSize: 10, letterSpacing: 5.5, marginTop: 3 },
  close: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  closeText: { color: colors.text, fontSize: 27, lineHeight: 29 },
  access: { color: colors.yellow, fontWeight: "900", fontSize: 10, letterSpacing: 1.8, marginVertical: 20 },
  section: { marginBottom: 22 },
  sectionTitle: { color: colors.muted2, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 8 },
  item: { minHeight: 56, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  itemIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", marginRight: 12 },
  itemIconText: { color: colors.yellow, fontWeight: "900" },
  itemText: { color: colors.text, fontWeight: "700", flex: 1, fontSize: 14 },
  badge: { color: colors.yellow, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  chev: { color: colors.muted, fontSize: 24 },
});

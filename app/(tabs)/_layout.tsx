import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Text, View, ColorValue} from "react-native";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/store/auth";

const icon=(symbol:string,color:string)=><Text style={{color,fontSize:22,fontWeight:"900"}}>{symbol}</Text>;
export default function TabsLayout(){
  const{session,loading}=useAuth();
  if(loading)return <View style={{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.bg}}><ActivityIndicator color={colors.yellow}/></View>;
  if(!session)return <Redirect href="/login"/>;
  return <Tabs screenOptions={{
    headerShown:false,
    tabBarStyle:{backgroundColor:"#0A0A0B",borderTopColor:colors.border,height:78,paddingTop:7,paddingBottom:8},
    tabBarLabelStyle:{fontSize:11,fontWeight:"700"},
    tabBarActiveTintColor:colors.yellow,
    tabBarInactiveTintColor:colors.muted,
    sceneStyle:{backgroundColor:colors.bg}
  }}>
    <Tabs.Screen name="index" options={{title:"Accueil",tabBarIcon:({color})=>icon("⌂", String(color))}}/>
    <Tabs.Screen name="training" options={{title:"Programme",tabBarIcon:({color})=>icon("▣", String(color))}}/>
    <Tabs.Screen name="stats" options={{title:"Stats",tabBarIcon:({color})=>icon("▥", String(color))}}/>
    <Tabs.Screen name="profile" options={{title:"Profil",tabBarIcon:({color})=>icon("♙", String(color))}}/>
    <Tabs.Screen name="journal" options={{href:null}}/>
  </Tabs>;
}

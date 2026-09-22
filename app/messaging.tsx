import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenScrollView } from "@/src/components/screen-scroll-view";
import { useEffect, useRef, useState } from "react";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { ActivityIndicator, Alert, Image, InteractionManager, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { colors } from "@/src/theme";
import { supabase } from "@/src/lib/supabase";
import { BackScreenHeader } from "@/src/components/ui";
import { ProfileAvatar } from "@/src/components/profile-avatar";

type Profile = { id:string; first_name:string|null; last_name:string|null; role:string; avatar_url?:string|null };
type Contact = {
  id:string;
  name:string;
  role:string;
  unreadCount:number;
  avatarUrl:string|null;
};
type Message = { id:string; conversation_id:string; sender_id:string; type:string; content:string|null; media_url:string|null; media_duration:number|null; created_at:string; read_at:string|null };
const MAX_IMAGE_BYTES=10*1024*1024;
const MAX_VIDEO_BYTES=50*1024*1024;

export default function MessagingScreen(){
 const insets=useSafeAreaInsets();
 const {width}=useWindowDimensions();
 const mediaWidth=Math.min(220,Math.max(80,(width-32-insets.left-insets.right)*.82-30));
 const [userId,setUserId]=useState(""); const [role,setRole]=useState(""); const [contacts,setContacts]=useState<Contact[]>([]); const [selectedContact,setSelectedContact]=useState<Contact|null>(null); const [conversationId,setConversationId]=useState<string|null>(null); const [messages,setMessages]=useState<Message[]>([]); const [mediaUrls,setMediaUrls]=useState<Record<string,string>>({}); const [text,setText]=useState(""); const [loading,setLoading]=useState(true); const [chatLoading,setChatLoading]=useState(false); const [sending,setSending]=useState(false); const [mediaSending,setMediaSending]=useState(false); const [error,setError]=useState("");
 const scrollRef=useRef<ScrollView>(null); const messagesRef=useRef<Message[]>([]); const openRequestRef=useRef(0); const mountedRef=useRef(true); const autoScrollUntilRef=useRef(0);
 useEffect(()=>{
  mountedRef.current=true;

  const task=InteractionManager.runAfterInteractions(()=>{
    void bootstrap();
  });

  return()=>{
    mountedRef.current=false;
    task.cancel();
    openRequestRef.current+=1;
  };
 },[]);
 useEffect(()=>{messagesRef.current=messages;},[messages]);
 useEffect(()=>{
  if(!userId||selectedContact)return;

  let refreshTimer:ReturnType<typeof setTimeout>|null=null;

  const scheduleRefresh=()=>{
    if(refreshTimer)clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{
      refreshTimer=null;
      void refreshContactUnreadCounts(userId);
    },250);
  };

  const channel=supabase
    .channel(`messaging-list-unread-${userId}`)
    .on(
      "postgres_changes",
      {event:"*",schema:"public",table:"messages"},
      scheduleRefresh
    )
    .subscribe();

  return()=>{
    if(refreshTimer)clearTimeout(refreshTimer);
    void supabase.removeChannel(channel);
  };
 },[userId,selectedContact]);
 useEffect(()=>{if(!conversationId)return; const channel=supabase.channel(`messages:${conversationId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},payload=>{const incoming=payload.new as Message; autoScrollUntilRef.current=Date.now()+700; setMessages(current=>current.some(m=>m.id===incoming.id)?current:[...current,incoming]); if(isMediaMessage(incoming)&&incoming.media_url){void getSignedMediaUrl(incoming.media_url).then(url=>setMediaUrls(current=>({...current,[incoming.id]:url}))).catch(()=>{});}}).subscribe(); return()=>{void supabase.removeChannel(channel);};},[conversationId]);
 async function markConversationRead(
  targetConversationId: string,
  currentMessages: Message[],
  contactId?: string
 ) {
  if (!targetConversationId || !userId) return;

  const unreadIds = currentMessages
    .filter(
      (message) =>
        message.sender_id !== userId &&
        !message.read_at
    )
    .map((message) => message.id);

  if (!unreadIds.length) return;

  const readAt = new Date().toISOString();

  const { error } = await supabase
    .from("messages")
    .update({ read_at: readAt })
    .in("id", unreadIds);

  if (error) {
    console.warn("Mark messages as read failed:", error.message);
    return;
  }

  const unreadIdSet = new Set(unreadIds);

  setMessages((current) =>
    current.map((message) =>
      unreadIdSet.has(message.id)
        ? { ...message, read_at: readAt }
        : message
    )
  );

  const peerId=contactId??selectedContact?.id;

  if(peerId){
    setContacts((current)=>
      current.map((contact)=>
        contact.id===peerId
          ? {...contact,unreadCount:0}
          : contact
      )
    );
  }
 }

 useEffect(() => {
  if (!conversationId || !userId) return;

  void markConversationRead(conversationId, messages, selectedContact?.id);
}, [conversationId, userId, messages]);

useEffect(()=>{if(!conversationId)return; const interval=setInterval(()=>{void loadMediaUrls(messagesRef.current,openRequestRef.current);},45*60*1000); return()=>clearInterval(interval);},[conversationId]);
 function isMediaMessage(message:Message){return (message.type==="image"||message.type==="video"||message.type==="audio")&&Boolean(message.media_url);}
 async function loadUnreadByContact(currentUserId:string){
  const {data:conversationRows,error:conversationError}=await supabase
    .from("conversations")
    .select("id, coach_id, athlete_id")
    .or(`coach_id.eq.${currentUserId},athlete_id.eq.${currentUserId}`);

  if(conversationError)throw conversationError;

  const rows=conversationRows??[];
  const conversationIds=rows.map((row:any)=>String(row.id));
  const peerByConversation=new Map<string,string>(
    rows.map((row:any)=>[
      String(row.id),
      String(row.coach_id)===String(currentUserId)
        ? String(row.athlete_id)
        : String(row.coach_id)
    ])
  );

  const unreadByPeer:Record<string,number>={};

  if(conversationIds.length){
    const {data:unreadRows,error:unreadError}=await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id",conversationIds)
      .neq("sender_id",currentUserId)
      .is("read_at",null);

    if(unreadError)throw unreadError;

    for(const row of unreadRows??[]){
      const peerId=peerByConversation.get(String((row as any).conversation_id));
      if(!peerId)continue;
      unreadByPeer[peerId]=(unreadByPeer[peerId]??0)+1;
    }
  }

  return unreadByPeer;
 }

 async function refreshContactUnreadCounts(currentUserId=userId){
  if(!currentUserId)return;

  try{
    const unreadByPeer=await loadUnreadByContact(currentUserId);

    if(!mountedRef.current)return;

    setContacts((current)=>
      current
        .map((contact)=>({
          ...contact,
          unreadCount:unreadByPeer[contact.id]??0
        }))
        .sort((a,b)=>
          b.unreadCount-a.unreadCount ||
          a.name.localeCompare(b.name,"fr")
        )
    );
  }catch(e:any){
    console.warn("CONTACT UNREAD REFRESH",e?.message??e);
  }
 }

 async function bootstrap(){try{if(!mountedRef.current)return;setLoading(true);setError("");const {data:{session},error:sessionError}=await supabase.auth.getSession();if(sessionError)throw sessionError;const user=session?.user;if(!user)throw new Error("Utilisateur non connecté.");if(!mountedRef.current)return;setUserId(user.id);const [profileResult,relsResult]=await Promise.all([supabase.from("profiles").select("id, first_name, last_name, role, avatar_url").eq("id",user.id).single(),supabase.from("coach_athlete_relationships").select("coach_id, athlete_id").eq("status","active").or(`coach_id.eq.${user.id},athlete_id.eq.${user.id}`)]);if(profileResult.error)throw profileResult.error;if(relsResult.error)throw relsResult.error;const profile=profileResult.data;const rels=relsResult.data;const userRole=String(profile.role);if(!mountedRef.current)return;setRole(userRole);const ids=(rels??[]).map((r:any)=>String(r.coach_id)===String(user.id)?r.athlete_id:r.coach_id);if(!ids.length){if(mountedRef.current)setContacts([]);return;}const [profilesResult,unreadByPeer]=await Promise.all([supabase.from("profiles").select("id, first_name, last_name, role, avatar_url").in("id",ids),loadUnreadByContact(user.id)]);if(profilesResult.error)throw profilesResult.error;if(!mountedRef.current)return;setContacts((profilesResult.data??[]).map((p:Profile)=>({id:p.id,name:[p.first_name,p.last_name].filter(Boolean).join(" ")||(userRole==="coach"?"Athlète":"Coach"),role:userRole==="coach"?"Athlète":"Coach",unreadCount:unreadByPeer[p.id]??0,avatarUrl:p.avatar_url??null})).sort((a,b)=>b.unreadCount-a.unreadCount||a.name.localeCompare(b.name,"fr")));}catch(e:any){if(mountedRef.current)setError(e?.message??"Impossible de charger la messagerie.");}finally{if(mountedRef.current)setLoading(false);}}
 async function openContact(contact:Contact){const requestId=++openRequestRef.current;try{autoScrollUntilRef.current=Date.now()+1800;setSelectedContact(contact);setChatLoading(true);setError("");setMessages([]);setMediaUrls({});const coachId=role==="coach"?userId:contact.id;const athleteId=role==="coach"?contact.id:userId;let {data:conversation,error:findError}=await supabase.from("conversations").select("id").eq("coach_id",coachId).eq("athlete_id",athleteId).maybeSingle();if(findError)throw findError;if(!conversation){const {data:created,error:createError}=await supabase.from("conversations").insert({coach_id:coachId,athlete_id:athleteId}).select("id").single();if(createError){if(createError.code!=="23505")throw createError;const {data:concurrentConversation,error:concurrentError}=await supabase.from("conversations").select("id").eq("coach_id",coachId).eq("athlete_id",athleteId).single();if(concurrentError)throw concurrentError;conversation=concurrentConversation;}else conversation=created;}if(requestId!==openRequestRef.current)return;setConversationId(conversation.id);const {data:history,error:historyError}=await supabase.from("messages").select("id, conversation_id, sender_id, type, content, media_url, media_duration, created_at, read_at").eq("conversation_id",conversation.id).order("created_at",{ascending:false}).limit(100);if(historyError)throw historyError;if(requestId!==openRequestRef.current)return;const loadedMessages=[...(history??[])].reverse() as Message[];setMessages(loadedMessages);setChatLoading(false);void markConversationRead(conversation.id,loadedMessages,contact.id);void loadMediaUrls(loadedMessages,requestId);}catch(e:any){if(requestId===openRequestRef.current){setError(e?.message??"Impossible d'ouvrir la conversation.");setChatLoading(false);}}}
 async function loadMediaUrls(list:Message[],requestId:number){const mediaMessages=list.filter(isMediaMessage).slice(-12);if(!mediaMessages.length||requestId!==openRequestRef.current)return;const entries=await Promise.all(mediaMessages.map(async(message):Promise<[string,string]|null>=>{if(!message.media_url)return null;try{const url=await getSignedMediaUrl(message.media_url);return [message.id,url];}catch{return null;}}));if(requestId!==openRequestRef.current)return;const validEntries=entries.filter((entry):entry is [string,string]=>entry!==null);if(validEntries.length)setMediaUrls(current=>({...current,...Object.fromEntries(validEntries)}));}
 async function getSignedMediaUrl(path:string){const {data,error}=await supabase.storage.from("chat-media").createSignedUrl(path,60*60);if(error)throw error;return data.signedUrl;}
 async function uploadChatMedia(localUri:string,kind:"image"|"video",mimeType?:string|null,fileName?:string|null,fileSize?:number|null){if(!conversationId||!userId)throw new Error("Conversation indisponible.");const maxBytes=kind==="image"?MAX_IMAGE_BYTES:MAX_VIDEO_BYTES;const maxLabel=kind==="image"?"10 Mo":"50 Mo";if(fileSize!=null&&fileSize>maxBytes)throw new Error(`${kind==="image"?"L'image":"La vidéo"} dépasse la taille maximale autorisée (${maxLabel}).`);const extension=fileName?.split(".").pop()?.toLowerCase()||(kind==="image"?"jpg":"mp4");const path=`${conversationId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;const contentType=kind==="image"?"image/jpeg":"video/mp4";
const {data:{session}}=await supabase.auth.getSession();
if(!session?.access_token)throw new Error("Session expirée. Reconnecte-toi.");
const supabaseUrl=process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!supabaseUrl||!supabaseKey)throw new Error("Configuration Supabase absente.");
const encodedPath=path.split("/").map(encodeURIComponent).join("/");
const uploadResult=await FileSystemLegacy.uploadAsync(
  `${supabaseUrl}/storage/v1/object/chat-media/${encodedPath}`,
  localUri,
  {
    httpMethod:"POST",
    uploadType:FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
    headers:{
      Authorization:`Bearer ${session.access_token}`,
      apikey:supabaseKey,
      "Content-Type":contentType,
      "x-upsert":"false",
      "cache-control":"max-age=3600"
    }
  }
);
if(uploadResult.status<200||uploadResult.status>=300){
  throw new Error(`Impossible d'envoyer le média (${uploadResult.status}).`);
}
return path;}
 async function sendMediaMessage(type:"image"|"video",storagePath:string){if(!conversationId)throw new Error("Conversation indisponible.");const {error}=await supabase.from("messages").insert({conversation_id:conversationId,sender_id:userId,type,media_url:storagePath});if(error){await supabase.storage.from("chat-media").remove([storagePath]).catch(()=>{});throw error;}}
 async function pickMedia(){if(!conversationId||mediaSending)return;try{setError("");const ImagePicker=await import("expo-image-picker");const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){Alert.alert("Autorisation nécessaire","Evolve Training a besoin d'accéder à tes photos et vidéos.");return;}const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images","videos"],allowsMultipleSelection:false,quality:0.85,videoMaxDuration:120});if(result.canceled||!result.assets?.length)return;const asset=result.assets[0];const type=asset.type==="video"?"video":"image";setMediaSending(true);const path=await uploadChatMedia(asset.uri,type,asset.mimeType,asset.fileName,asset.fileSize);await sendMediaMessage(type,path);}catch(e:any){setError(e?.message??"Impossible d'envoyer ce média.");}finally{setMediaSending(false);}}
 async function sendText(){const body=text.trim();if(!body||!conversationId||sending)return;try{setSending(true);setError("");setText("");const {error}=await supabase.from("messages").insert({conversation_id:conversationId,sender_id:userId,type:"text",content:body});if(error){setText(body);throw error;}}catch(e:any){setError(e?.message??"Impossible d'envoyer le message.");}finally{setSending(false);}}
 function backFromChat(){++openRequestRef.current;setSelectedContact(null);setConversationId(null);setMessages([]);setMediaUrls({});setError("");void refreshContactUnreadCounts();}
 function openMedia(message:Message){const url=mediaUrls[message.id];if(!url)return;void Linking.openURL(url).catch(()=>setError("Impossible d'ouvrir ce média."));}
 if(loading)return <View style={styles.center}><ActivityIndicator color={colors.yellow} size="large"/></View>;
 if(!selectedContact)return <ScreenScrollView automaticallyAdjustKeyboardInsets={false} contentContainerStyle={styles.page}><BackScreenHeader eyebrow="EVOLVE TRAINING" title="Messagerie" subtitle={role==="coach"?"Échange avec tes athlètes.":"Échange directement avec ton coach."}/>{error?<Text style={styles.error}>{error}</Text>:null}<Text style={styles.sectionTitle}>CONVERSATIONS</Text>{!contacts.length?<View style={styles.emptyCard}><Text style={styles.emptyTitle}>Aucune conversation disponible</Text><Text style={styles.emptyText}>Une relation coach-athlète active est nécessaire.</Text></View>:contacts.map(contact=><Pressable key={contact.id} style={[styles.contactCard,contact.unreadCount>0&&styles.contactCardUnread]} onPress={()=>void openContact(contact)}><ProfileAvatar name={contact.name} uri={contact.avatarUrl}/><View style={styles.contactIdentity}><Text style={styles.contactName}>{contact.name}</Text><Text style={[styles.contactRole,contact.unreadCount>0&&styles.contactRoleUnread]}>{contact.unreadCount>0?`${contact.unreadCount} nouveau${contact.unreadCount>1?"x":""} message${contact.unreadCount>1?"s":""}`:contact.role}</Text></View>{contact.unreadCount>0?<View style={styles.contactUnreadBadge}><Text style={styles.contactUnreadBadgeText}>{contact.unreadCount>99?"99+":contact.unreadCount}</Text></View>:<Text style={styles.chevron}>›</Text>}</Pressable>)}</ScreenScrollView>;
 return <KeyboardAvoidingView style={[styles.chatPage,{paddingLeft:insets.left,paddingRight:insets.right}]} behavior={Platform.OS==="ios"?"padding":undefined}><View style={[styles.chatHeader,{paddingTop:insets.top+12}]}><Pressable onPress={backFromChat} hitSlop={10}><Text style={styles.chatBack}>‹</Text></Pressable><ProfileAvatar name={selectedContact.name} uri={selectedContact.avatarUrl} size={44}/><View style={styles.chatHeaderIdentity}><Text style={styles.chatName}>{selectedContact.name}</Text><Text style={styles.chatRole}>{selectedContact.role}</Text></View></View><ScrollView ref={scrollRef} style={styles.messageArea} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onContentSizeChange={()=>{if(Date.now()<=autoScrollUntilRef.current){scrollRef.current?.scrollToEnd({animated:false});}}}>{chatLoading?<View style={styles.chatLoadingInline}><ActivityIndicator color={colors.yellow} size="large"/></View>:null}{!messages.length?<View style={styles.firstMessage}><Text style={styles.firstTitle}>CONVERSATION EVOLVE</Text><Text style={styles.firstText}>Envoie ton premier message.</Text></View>:null}{messages.map(message=>{const mine=message.sender_id===userId;const mediaUrl=mediaUrls[message.id];return <View key={message.id} style={[styles.messageRow,mine?styles.messageRowMine:styles.messageRowOther]}><View style={[styles.bubble,mine?styles.bubbleMine:styles.bubbleOther]}>{message.type==="text"?<Text style={[styles.messageText,mine&&styles.messageTextMine]}>{message.content}</Text>:message.type==="image"&&mediaUrl?<Pressable onPress={()=>openMedia(message)}><Image source={{uri:mediaUrl}} style={[styles.messageImage,{width:mediaWidth,height:mediaWidth}]} resizeMode="cover"/></Pressable>:message.type==="video"&&mediaUrl?<Pressable style={[styles.mediaCard,{minWidth:0,width:mediaWidth}]} onPress={()=>openMedia(message)}><Text style={styles.mediaIcon}>▶</Text><View style={styles.mediaInfo}><Text style={styles.mediaTitle}>VIDÉO</Text><Text style={styles.mediaSubtitle}>Appuyer pour ouvrir</Text></View></Pressable>:message.type==="audio"&&mediaUrl?<Pressable style={[styles.mediaCard,{minWidth:0,width:mediaWidth}]} onPress={()=>openMedia(message)}><Text style={styles.mediaIcon}>◉</Text><View style={styles.mediaInfo}><Text style={styles.mediaTitle}>MESSAGE VOCAL</Text><Text style={styles.mediaSubtitle}>Appuyer pour ouvrir</Text></View></Pressable>:<Text style={styles.messageText}>Média indisponible</Text>}<Text style={[styles.messageTime,mine&&styles.messageTimeMine]}>{new Date(message.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</Text></View></View>})}{error?<Text style={styles.error}>{error}</Text>:null}</ScrollView><View style={[styles.composer,{paddingBottom:Math.max(12,insets.bottom)}]}><Pressable style={styles.mediaButton} onPress={()=>void pickMedia()} disabled={mediaSending}><Text style={styles.mediaButtonText}>{mediaSending?"…":"＋"}</Text></Pressable><TextInput value={text} onChangeText={setText} placeholder="Écrire un message..." placeholderTextColor={colors.muted} style={styles.textInput} multiline maxLength={2000} editable={!sending}/><Pressable style={[styles.sendButton,(!text.trim()||sending)&&styles.sendButtonDisabled]} onPress={()=>void sendText()} disabled={!text.trim()||sending}><Text style={styles.sendButtonText}>{sending?"…":"↑"}</Text></Pressable></View></KeyboardAvoidingView>;
}
const styles=StyleSheet.create({
 page:{flexGrow:1,padding:20,paddingTop:58,paddingBottom:120,backgroundColor:"transparent"},
 center:{flex:1,justifyContent:"center",alignItems:"center",backgroundColor:"transparent"},
 chatLoadingInline:{minHeight:180,justifyContent:"center",alignItems:"center"},
 back:{color:colors.yellow,fontWeight:"900",marginBottom:18},sectionTitle:{color:colors.text,fontSize:20,fontWeight:"900",letterSpacing:1.4,marginBottom:14},contactCard:{minHeight:84,flexDirection:"row",alignItems:"center",gap:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,borderRadius:20,padding:14,marginBottom:12},
 contactCardUnread:{borderColor:colors.yellow,backgroundColor:"#151300"},
 contactIdentity:{flex:1},contactName:{color:colors.text,fontSize:18,fontWeight:"900"},contactRole:{color:colors.muted,marginTop:4},
 contactRoleUnread:{color:colors.yellow,fontWeight:"900"},
 contactUnreadBadge:{minWidth:28,height:28,borderRadius:14,paddingHorizontal:7,backgroundColor:colors.yellow,alignItems:"center",justifyContent:"center"},
 contactUnreadBadgeText:{color:"#080808",fontSize:11,fontWeight:"900"},
 chevron:{color:colors.text,fontSize:34},emptyCard:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,borderRadius:20,padding:22},emptyTitle:{color:colors.text,fontSize:18,fontWeight:"900"},emptyText:{color:colors.muted,lineHeight:21,marginTop:8},error:{color:"#ff6464",textAlign:"center",marginVertical:10},
 chatPage:{flex:1,backgroundColor:"transparent"},chatHeader:{minHeight:82,paddingTop:30,paddingHorizontal:14,paddingBottom:12,borderBottomWidth:1,borderBottomColor:colors.border,backgroundColor:"#090909",flexDirection:"row",alignItems:"center",gap:10},chatBack:{color:colors.yellow,fontSize:40},chatHeaderIdentity:{flex:1},chatName:{color:colors.text,fontSize:18,fontWeight:"900"},chatRole:{color:colors.muted,fontSize:12,marginTop:2},messageArea:{flex:1,backgroundColor:"transparent"},messageContent:{padding:16,paddingBottom:28,flexGrow:1},firstMessage:{alignItems:"center",marginVertical:30},firstTitle:{color:colors.yellow,fontSize:12,fontWeight:"900",letterSpacing:1.4},firstText:{color:colors.muted,marginTop:5},messageRow:{width:"100%",marginVertical:4},messageRowMine:{alignItems:"flex-end"},messageRowOther:{alignItems:"flex-start"},bubble:{maxWidth:"82%",borderRadius:18,paddingHorizontal:14,paddingVertical:10},bubbleMine:{backgroundColor:colors.yellow,borderBottomRightRadius:5},bubbleOther:{backgroundColor:colors.surface2,borderWidth:1,borderColor:colors.border,borderBottomLeftRadius:5},messageText:{color:colors.text,fontSize:16,lineHeight:21},messageTextMine:{color:"#111"},messageImage:{width:220,height:220,borderRadius:14,backgroundColor:"#111"},mediaCard:{minWidth:210,minHeight:64,flexDirection:"row",alignItems:"center",gap:12,paddingHorizontal:12,paddingVertical:10},mediaIcon:{color:colors.yellow,fontSize:25,fontWeight:"900"},mediaInfo:{flex:1},mediaTitle:{color:colors.text,fontSize:13,fontWeight:"900",letterSpacing:.8},mediaSubtitle:{color:colors.muted,fontSize:12,marginTop:3},messageTime:{color:colors.muted,fontSize:10,marginTop:5,alignSelf:"flex-end"},messageTimeMine:{color:"#4b3b00"},composer:{flexDirection:"row",alignItems:"flex-end",gap:8,paddingHorizontal:10,paddingTop:9,paddingBottom:Platform.OS==="android"?18:28,borderTopWidth:1,borderTopColor:colors.border,backgroundColor:"#090909"},mediaButton:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},mediaButtonText:{color:colors.yellow,fontSize:26},textInput:{flex:1,minHeight:42,maxHeight:110,backgroundColor:colors.surface2,borderWidth:1,borderColor:colors.border,borderRadius:18,color:colors.text,paddingHorizontal:14,paddingVertical:10,fontSize:15},sendButton:{width:42,height:42,borderRadius:14,backgroundColor:colors.yellow,alignItems:"center",justifyContent:"center"},sendButtonDisabled:{opacity:.45},sendButtonText:{color:"#111",fontSize:24,fontWeight:"900"}
});

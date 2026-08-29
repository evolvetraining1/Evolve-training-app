import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { VideoView, useVideoPlayer } from "expo-video";

import { colors } from "@/src/theme";
import { supabase } from "@/src/lib/supabase";
import { ScreenHeader } from "@/src/components/ui";

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  avatar_url?: string | null;
};

type Contact = {
  id: string;
  name: string;
  role: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  content: string | null;
  media_url: string | null;
  media_duration: number | null;
  created_at: string;
  read_at: string | null;
};


function AudioMessage({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);

  return (
    <Pressable
      style={styles.audioMessage}
      onPress={() => {
        try {
          player.seekTo(0);
          player.play();
        } catch {}
      }}
    >
      <Text style={styles.audioPlay}>▶</Text>

      <View style={styles.audioInfo}>
        <Text style={styles.audioTitle}>MESSAGE VOCAL</Text>
        <Text style={styles.audioSubtitle}>
          Appuyer pour écouter
        </Text>
      </View>
    </Pressable>
  );
}


function VideoMessage({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);

  return (
    <VideoView
      style={styles.messageVideo}
      player={player}
      nativeControls
      contentFit="cover"
      surfaceType="textureView"
    />
  );
}

export default function MessagingScreen() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioRecorderState = useAudioRecorderState(audioRecorder);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");

  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mediaSending, setMediaSending] = useState(false);
  const [voiceSending, setVoiceSending] = useState(false);
  const [error, setError] = useState("");

  const scrollRef = useRef<ScrollView>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;

    const refreshSignedMediaUrls = async () => {
      const mediaMessages = messagesRef.current.filter(
        (m) =>
          (m.type === "image" ||
            m.type === "video" ||
            m.type === "audio") &&
          m.media_url
      );

      if (!mediaMessages.length) return;

      const refreshed = await Promise.all(
        mediaMessages.map(async (m) => {
          try {
            const url = await getSignedMediaUrl(m.media_url!);
            return [m.id, url] as const;
          } catch {
            return null;
          }
        })
      );

      const entries = refreshed.filter(Boolean) as [string, string][];

      if (entries.length) {
        setMediaUrls((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
      }
    };

    const interval = setInterval(() => {
      void refreshSignedMediaUrls();
    }, 45 * 60 * 1000);

    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;

          setMessages((current) => {
            if (current.some((m) => m.id === incoming.id)) return current;
            return [...current, incoming];
          });

          if (
            (incoming.type === "image" ||
              incoming.type === "video" ||
              incoming.type === "audio") &&
            incoming.media_url
          ) {
            getSignedMediaUrl(incoming.media_url)
              .then((url) => {
                setMediaUrls((current) => ({
                  ...current,
                  [incoming.id]: url,
                }));
              })
              .catch(() => {});
          }

          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 80);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function bootstrap() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Utilisateur non connecté.");

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role, avatar_url")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const userRole = String(profile.role);
      setRole(userRole);

      if (userRole === "coach") {
        const { data: rels, error: relError } = await supabase
          .from("coach_athlete_relationships")
          .select("athlete_id")
          .eq("coach_id", user.id)
          .eq("status", "active");

        if (relError) throw relError;

        const ids = (rels ?? []).map((r: any) => r.athlete_id);

        if (!ids.length) {
          setContacts([]);
          return;
        }

        const { data: profiles, error: peersError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, role")
          .in("id", ids);

        if (peersError) throw peersError;

        setContacts(
          (profiles ?? []).map((p: Profile) => ({
            id: p.id,
            name:
              [p.first_name, p.last_name].filter(Boolean).join(" ") ||
              "Athlète",
            role: "Athlète",
          }))
        );
      } else {
        const { data: rels, error: relError } = await supabase
          .from("coach_athlete_relationships")
          .select("coach_id")
          .eq("athlete_id", user.id)
          .eq("status", "active");

        if (relError) throw relError;

        const ids = (rels ?? []).map((r: any) => r.coach_id);

        if (!ids.length) {
          setContacts([]);
          return;
        }

        const { data: profiles, error: peersError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, role")
          .in("id", ids);

        if (peersError) throw peersError;

        setContacts(
          (profiles ?? []).map((p: Profile) => ({
            id: p.id,
            name:
              [p.first_name, p.last_name].filter(Boolean).join(" ") ||
              "Coach",
            role: "Coach",
          }))
        );
      }
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger la messagerie.");
    } finally {
      setLoading(false);
    }
  }

  async function openContact(contact: Contact) {
    try {
      setSelectedContact(contact);
      setChatLoading(true);
      setError("");
      setMessages([]);

      const coachId = role === "coach" ? userId : contact.id;
      const athleteId = role === "coach" ? contact.id : userId;

      let { data: conversation, error: findError } = await supabase
        .from("conversations")
        .select("id")
        .eq("coach_id", coachId)
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (findError) throw findError;

      if (!conversation) {
        const { data: created, error: createError } = await supabase
          .from("conversations")
          .insert({
            coach_id: coachId,
            athlete_id: athleteId,
          })
          .select("id")
          .single();

        if (createError) {
          // Si coach et athlète créent la conversation simultanément,
          // l'index unique bloque le second INSERT.
          // On récupère alors la conversation créée par l'autre appel.
          if (createError.code === "23505") {
            const { data: concurrentConversation, error: concurrentError } =
              await supabase
                .from("conversations")
                .select("id")
                .eq("coach_id", coachId)
                .eq("athlete_id", athleteId)
                .single();

            if (concurrentError) throw concurrentError;
            conversation = concurrentConversation;
          } else {
            throw createError;
          }
        } else {
          conversation = created;
        }
      }

      setConversationId(conversation.id);

      const { data: history, error: historyError } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (historyError) throw historyError;

      const loadedMessages = ([...(history ?? [])].reverse()) as Message[];
      setMessages(loadedMessages);

      const signedEntries = await Promise.all(
        loadedMessages
          .filter(
            (m) =>
              (m.type === "image" ||
                m.type === "video" ||
                m.type === "audio") &&
              m.media_url
          )
          .map(async (m) => {
            try {
              const url = await getSignedMediaUrl(m.media_url!);
              return [m.id, url] as const;
            } catch {
              return null;
            }
          })
      );

      setMediaUrls(
        Object.fromEntries(
          signedEntries.filter(Boolean) as [string, string][]
        )
      );

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'ouvrir la conversation.");
    } finally {
      setChatLoading(false);
    }
  }


  async function uploadChatMedia(
    localUri: string,
    kind: "image" | "video",
    mimeType?: string | null,
    fileName?: string | null
  ) {
    if (!conversationId || !userId) {
      throw new Error("Conversation indisponible.");
    }

    const response = await fetch(localUri);
    const blob = await response.blob();

    const extension =
      fileName?.split(".").pop()?.toLowerCase() ||
      (kind === "image" ? "jpg" : "mp4");

    const path =
      `${conversationId}/${userId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(path, blob, {
        contentType:
          mimeType ||
          (kind === "image" ? "image/jpeg" : "video/mp4"),
        upsert: false,
      });

    if (uploadError) throw uploadError;

    return path;
  }

  async function sendMediaMessage(
    type: "image" | "video",
    storagePath: string
  ) {
    if (!conversationId) {
      throw new Error("Conversation indisponible.");
    }

    const { error: sendError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      type,
      media_url: storagePath,
    });

    if (sendError) {
      await supabase.storage
        .from("chat-media")
        .remove([storagePath])
        .catch(() => {});

      throw sendError;
    }
  }

  async function pickMedia() {
    if (!conversationId || mediaSending) return;

    try {
      setError("");

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Autorisation nécessaire",
          "Evolve Training a besoin d'accéder à tes photos et vidéos."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: false,
        quality: 0.85,
        videoMaxDuration: 120,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];

      const type =
        asset.type === "video"
          ? "video"
          : "image";

      setMediaSending(true);

      const path = await uploadChatMedia(
        asset.uri,
        type,
        asset.mimeType,
        asset.fileName
      );

      await sendMediaMessage(type, path);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible d'envoyer ce média."
      );
    } finally {
      setMediaSending(false);
    }
  }

  async function getSignedMediaUrl(path: string) {
    const { data, error: signedError } =
      await supabase.storage
        .from("chat-media")
        .createSignedUrl(path, 60 * 60);

    if (signedError) throw signedError;

    return data.signedUrl;
  }


  async function startVoiceRecording() {
    if (!conversationId || voiceSending) return;

    try {
      setError("");

      const permission =
        await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Microphone",
          "Evolve Training a besoin du microphone pour enregistrer un message vocal."
        );
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible de démarrer l'enregistrement."
      );
    }
  }

  async function stopVoiceRecording() {
    if (!audioRecorderState.isRecording || voiceSending) return;

    try {
      setVoiceSending(true);
      setError("");

      await audioRecorder.stop();

      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error("Aucun enregistrement audio disponible.");
      }

      if (!conversationId || !userId) {
        throw new Error("Conversation indisponible.");
      }

      const response = await fetch(uri);
      const blob = await response.blob();

      const storagePath =
        `${conversationId}/${userId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.m4a`;

      const { error: uploadError } =
        await supabase.storage
          .from("chat-media")
          .upload(storagePath, blob, {
            contentType: "audio/mp4",
            upsert: false,
          });

      if (uploadError) throw uploadError;

      const durationSeconds = Math.max(
        1,
        Math.round((audioRecorderState.durationMillis || 0) / 1000)
      );

      const { error: sendError } =
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: userId,
          type: "audio",
          media_url: storagePath,
          media_duration: durationSeconds,
        });

      if (sendError) {
        await supabase.storage
          .from("chat-media")
          .remove([storagePath])
          .catch(() => {});

        throw sendError;
      }

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (e: any) {
      setError(
        e?.message ??
          "Impossible d'envoyer le message vocal."
      );
    } finally {
      setVoiceSending(false);

      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      }).catch(() => {});
    }
  }

  async function toggleVoiceRecording() {
    if (audioRecorderState.isRecording) {
      await stopVoiceRecording();
    } else {
      await startVoiceRecording();
    }
  }

  async function sendText() {
    const body = text.trim();

    if (!body || !conversationId || sending) return;

    try {
      setSending(true);
      setError("");
      setText("");

      const { error: sendError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        type: "text",
        content: body,
      });

      if (sendError) {
        setText(body);
        throw sendError;
      }
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  }

  function backFromChat() {
    setSelectedContact(null);
    setConversationId(null);
    setMessages([]);
    setMediaUrls({});
    setError("");
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.yellow} size="large" />
      </View>
    );
  }

  if (!selectedContact) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.back} onPress={() => router.back()}>
          ← RETOUR
        </Text>

        <ScreenHeader
          eyebrow="EVOLVE TRAINING"
          title="Messagerie"
          subtitle={
            role === "coach"
              ? "Échange avec tes athlètes."
              : "Échange directement avec ton coach."
          }
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>CONVERSATIONS</Text>

        {!contacts.length ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Aucune conversation disponible
            </Text>
            <Text style={styles.emptyText}>
              Une relation coach-athlète active est nécessaire.
            </Text>
          </View>
        ) : (
          contacts.map((contact) => (
            <Pressable
              key={contact.id}
              style={styles.contactCard}
              onPress={() => openContact(contact)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {contact.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactRole}>{contact.role}</Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.chatPage}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.chatHeader}>
        <Pressable onPress={backFromChat}>
          <Text style={styles.chatBack}>‹</Text>
        </Pressable>

        <View style={styles.chatHeaderIdentity}>
          <Text style={styles.chatName}>{selectedContact.name}</Text>
          <Text style={styles.chatRole}>{selectedContact.role}</Text>
        </View>

        <View style={styles.callActions}>
          <Pressable style={styles.callButton}>
            <Text style={styles.callIcon}>☎</Text>
          </Pressable>

          <Pressable style={styles.callButton}>
            <Text style={styles.callIcon}>▣</Text>
          </Pressable>
        </View>
      </View>

      {chatLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.yellow} size="large" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.messageArea}
          contentContainerStyle={styles.messageContent}
          keyboardShouldPersistTaps="handled"
        >
          {!messages.length ? (
            <View style={styles.firstMessage}>
              <Text style={styles.firstTitle}>CONVERSATION EVOLVE</Text>
              <Text style={styles.firstText}>
                Envoie ton premier message.
              </Text>
            </View>
          ) : null}

          {messages.map((message) => {
            const mine = message.sender_id === userId;

            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  mine ? styles.messageRowMine : styles.messageRowOther,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleOther,
                  ]}
                >
                  {message.type === "text" ? (
                    <Text
                      style={[
                        styles.messageText,
                        mine && styles.messageTextMine,
                      ]}
                    >
                      {message.content}
                    </Text>
                  ) : message.type === "image" &&
                    mediaUrls[message.id] ? (
                    <Image
                      source={{ uri: mediaUrls[message.id] }}
                      style={styles.messageImage}
                      resizeMode="cover"
                    />
                  ) : message.type === "video" &&
                    mediaUrls[message.id] ? (
                    <VideoMessage uri={mediaUrls[message.id]} />
                  ) : message.type === "audio" &&
                    mediaUrls[message.id] ? (
                    <AudioMessage uri={mediaUrls[message.id]} />
                  ) : (
                    <Text style={styles.messageText}>
                      Chargement du média...
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.messageTime,
                      mine && styles.messageTimeMine,
                    ]}
                  >
                    {new Date(message.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            );
          })}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      )}

      {audioRecorderState.isRecording ? (
        <View style={styles.recordingBar}>
          <Text style={styles.recordingDot}>●</Text>
          <Text style={styles.recordingText}>
            ENREGISTREMENT EN COURS
          </Text>
          <Text style={styles.recordingTime}>
            {Math.floor(
              (audioRecorderState.durationMillis || 0) / 1000
            )} s
          </Text>
        </View>
      ) : null}

      <View style={styles.composer}>
        <Pressable
          style={styles.mediaButton}
          onPress={pickMedia}
          disabled={mediaSending}
        >
          <Text style={styles.mediaButtonText}>
            {mediaSending ? "…" : "＋"}
          </Text>
        </Pressable>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Écrire un message..."
          placeholderTextColor={colors.muted}
          style={styles.textInput}
          multiline
        />

        {text.trim() ? (
          <Pressable style={styles.sendButton} onPress={sendText}>
            <Text style={styles.sendButtonText}>↑</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.voiceButton}>
            <Text style={styles.voiceButtonText}>●</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 58,
    paddingBottom: 120,
    backgroundColor: "transparent",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },

  back: {
    color: colors.yellow,
    fontWeight: "900",
    marginBottom: 18,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 14,
  },

  contactCard: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.yellow,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  avatarText: {
    color: colors.yellow,
    fontSize: 22,
    fontWeight: "900",
  },

  contactName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  contactRole: {
    color: colors.muted,
    marginTop: 4,
  },

  chevron: {
    color: colors.text,
    fontSize: 34,
  },

  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 22,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  emptyText: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: 8,
  },

  error: {
    color: "#ff6464",
    textAlign: "center",
    marginVertical: 10,
  },

  chatPage: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  chatHeader: {
    minHeight: 94,
    paddingTop: 36,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "#090909",
    flexDirection: "row",
    alignItems: "center",
  },

  chatBack: {
    color: colors.yellow,
    fontSize: 40,
    marginRight: 8,
  },

  chatHeaderIdentity: {
    flex: 1,
  },

  chatName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  chatRole: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },

  callActions: {
    flexDirection: "row",
    gap: 8,
  },

  callButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  callIcon: {
    color: colors.yellow,
    fontSize: 18,
    fontWeight: "900",
  },

  messageArea: {
    flex: 1,
  },

  messageContent: {
    padding: 16,
    paddingBottom: 28,
  },

  firstMessage: {
    alignItems: "center",
    marginVertical: 30,
  },

  firstTitle: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  firstText: {
    color: colors.muted,
    marginTop: 5,
  },

  messageRow: {
    width: "100%",
    marginVertical: 4,
  },

  messageRowMine: {
    alignItems: "flex-end",
  },

  messageRowOther: {
    alignItems: "flex-start",
  },

  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  bubbleMine: {
    backgroundColor: colors.yellow,
    borderBottomRightRadius: 5,
  },

  bubbleOther: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 5,
  },

  messageText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
  },


  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: "#111",
  },

  messageVideo: {
    width: 240,
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111",
  },

  messageTextMine: {
    color: "#111",
  },

  messageTime: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 5,
    alignSelf: "flex-end",
  },

  messageTimeMine: {
    color: "#4b3b00",
  },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: Platform.OS === "android" ? 18 : 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#090909",
  },

  mediaButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  mediaButtonText: {
    color: colors.yellow,
    fontSize: 26,
  },

  textInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },

  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },

  sendButtonText: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
  },

  voiceButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },

  voiceButtonRecording: {
    borderColor: "#ff4646",
    backgroundColor: "#2a1010",
  },

  recordingBar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 8,
    backgroundColor: "#160b0b",
    borderTopWidth: 1,
    borderTopColor: "#4a2020",
  },

  recordingDot: {
    color: "#ff4646",
    fontSize: 16,
  },

  recordingText: {
    color: "#ff7070",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    flex: 1,
  },

  recordingTime: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },

  audioMessage: {
    minWidth: 210,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  audioPlay: {
    color: colors.yellow,
    fontSize: 25,
    fontWeight: "900",
  },

  audioInfo: {
    flex: 1,
  },

  audioTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  audioSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },

  voiceButtonText: {
    color: colors.yellow,
    fontSize: 15,
  },
});

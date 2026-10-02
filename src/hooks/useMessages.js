import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnectionRequests } from './useConnectionRequests';
import { supabase } from '../lib/supabase';

function mapMessage(row) {
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

function getOtherUserId(message, userId) {
  return message.senderId === userId ? message.receiverId : message.senderId;
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
}

export function useMessages(session, initialContactId) {
  const userId = session?.user?.id;
  const {
    connections,
    profilesByUserId: connectionProfiles,
    loading: loadingConnections,
    error: connectionsError,
  } = useConnectionRequests(session);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState({});
  const [loadedUserId, setLoadedUserId] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(Boolean(userId));
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');

  const loadConversations = useCallback(async () => {
    if (!supabase || !userId) {
      setMessages([]);
      setContacts({});
      setLoadedUserId('');
      setLoadingConversations(false);
      return;
    }

    if (loadingConnections) return;

    setLoadingConversations(true);
    setError('');

    try {
      const connectedUserIds = [...new Set(
        (connections || []).map((connection) =>
          connection.senderId === userId ? connection.receiverId : connection.senderId,
        ),
      )];
      if (connectionsError) throw new Error(connectionsError);

      const nextContacts = Object.fromEntries(
        connectedUserIds
          .filter((connectedUserId) => connectionProfiles[connectedUserId])
          .map((connectedUserId) => {
            const profile = connectionProfiles[connectedUserId];
            return [
              connectedUserId,
              {
                id: connectedUserId,
                name: profile.name || 'HackMate member',
                username: profile.username || '',
                avatarUrl: profile.avatar_url || '',
              },
            ];
          }),
      );
      const messageResult = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (messageResult.error) throw messageResult.error;

      setContacts(nextContacts);
      setMessages((messageResult.data || []).map(mapMessage).reverse());
      setLoadedUserId(userId);
    } catch {
      setError('Unable to load conversations. Please try again.');
      setMessages([]);
      setContacts({});
      setLoadedUserId(userId);
    } finally {
      setLoadingConversations(false);
    }
  }, [connectionProfiles, connections, connectionsError, loadingConnections, userId]);

  const syncMessages = useCallback(async () => {
    if (!supabase || !userId) return;

    try {
      const { data, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      setMessages((current) => mergeMessages(current, (data || []).map(mapMessage)));
    } catch {
      setError('Unable to load messages. Please try again.');
    }
  }, [userId]);

  useEffect(() => {
    const runLoad = async () => {
      await loadConversations();
    };

    void runLoad();
  }, [loadConversations]);

  useEffect(() => {
    if (!supabase || !userId || loadedUserId !== userId) return undefined;

    const appendRealtimeMessage = (payload) => {
      const incoming = mapMessage(payload.new);
      const otherUserId = getOtherUserId(incoming, userId);
      if (!contacts[otherUserId]) return;
      setMessages((current) => mergeMessages(current, [incoming]));
    };

    const channel = supabase
      .channel(`messages:user:${userId}:active:${initialContactId || 'list'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${userId}`,
        },
        appendRealtimeMessage,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        appendRealtimeMessage,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void syncMessages();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Live updates are temporarily unavailable. Please try again.');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [contacts, initialContactId, loadedUserId, syncMessages, userId]);

  const conversations = useMemo(() => {
    const latestByUser = new Map();
    messages.forEach((message) => {
      const otherUserId = getOtherUserId(message, userId);
      if (!contacts[otherUserId]) return;
      const currentLatest = latestByUser.get(otherUserId);
      if (!currentLatest || Date.parse(message.createdAt) > Date.parse(currentLatest.createdAt)) {
        latestByUser.set(otherUserId, message);
      }
    });

    return [...latestByUser.entries()]
      .map(([contactId, latestMessage]) => ({
        contact: contacts[contactId],
        latestMessage,
      }))
      .sort((left, right) =>
        Date.parse(right.latestMessage.createdAt) - Date.parse(left.latestMessage.createdAt),
      );
  }, [contacts, messages, userId]);

  const loadConversationMessages = useCallback(async (contactId) => {
    if (!supabase || !userId || !contactId || !contacts[contactId]) {
      setLoadingMessages(false);
      return;
    }

    setLoadingMessages(true);
    setError('');
    try {
      const { data, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userId})`,
        )
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      setMessages((current) => mergeMessages(current, (data || []).map(mapMessage)));
    } catch {
      setError('Unable to load messages. Please try again.');
    } finally {
      setLoadingMessages(false);
    }
  }, [contacts, userId]);

  const sendMessage = useCallback(async (receiverId, content) => {
    const cleanContent = String(content || '').trim();
    if (!cleanContent) return false;
    if (!supabase || !userId || receiverId === userId || !contacts[receiverId]) {
      setSendError('You can only message connected teammates.');
      return false;
    }

    setSending(true);
    setSendError('');
    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: userId,
          receiver_id: receiverId,
          content: cleanContent,
        })
        .select('id, sender_id, receiver_id, content, created_at')
        .single();

      if (insertError) {
        if (insertError.code === '42501') {
          throw new Error('You can only message connected teammates.');
        }
        throw insertError;
      }

      setMessages((current) => mergeMessages(current, [mapMessage(data)]));
      return true;
    } catch (caughtError) {
      setSendError(
        caughtError?.message === 'You can only message connected teammates.'
          ? caughtError.message
          : 'Message could not be sent. Please try again.',
      );
      return false;
    } finally {
      setSending(false);
    }
  }, [contacts, userId]);
  const clearSendError = useCallback(() => setSendError(''), []);

  const activeContact = loadedUserId === userId && initialContactId
    ? contacts[initialContactId] || null
    : null;
  const activeMessages = activeContact
    ? messages.filter(
        (message) =>
          (message.senderId === userId && message.receiverId === activeContact.id) ||
          (message.senderId === activeContact.id && message.receiverId === userId),
      )
    : [];
  const connectionError =
    loadedUserId === userId && Boolean(initialContactId) && !contacts[initialContactId];

  return {
    conversations: loadedUserId === userId ? conversations : [],
    activeContact,
    activeMessages,
    contacts: loadedUserId === userId ? contacts : {},
    loadingConversations: loadingConversations || loadedUserId !== userId,
    loadingMessages,
    sending,
    error,
    sendError,
    connectionError,
    loadConversationMessages,
    sendMessage,
    clearSendError,
    reloadConversations: loadConversations,
  };
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

function connectionStateForPair(requests, currentUserId, otherUserId) {
  const request = requests.find(
    (item) =>
      (item.senderId === currentUserId && item.receiverId === otherUserId) ||
      (item.senderId === otherUserId && item.receiverId === currentUserId),
  );

  if (!request) return 'none';
  if (request.status === 'accepted') return 'connected';
  if (request.status === 'rejected') return 'rejected';
  return request.senderId === currentUserId ? 'pending' : 'incoming';
}

export function useConnectionRequests(session) {
  const userId = session?.user?.id;
  const [requests, setRequests] = useState([]);
  const [profilesByUserId, setProfilesByUserId] = useState({});
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyRequestId, setBusyRequestId] = useState('');

  const reload = useCallback(async () => {
    if (!supabase || !userId) {
      setRequests([]);
      setProfilesByUserId({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: requestRows, error: requestError } = await supabase
        .from('connection_requests')
        .select('id, sender_id, receiver_id, status, created_at, updated_at')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (requestError) {
        throw requestError;
      }

      const counterpartIds = [...new Set(
        (requestRows || []).map((row) =>
          row.sender_id === userId ? row.receiver_id : row.sender_id,
        ),
      )];
      let profiles = [];

      if (counterpartIds.length) {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, name, username, role, avatar_url, is_public')
          .in('user_id', counterpartIds);

        if (profileError) {
          throw profileError;
        }

        profiles = data || [];
      }

      setRequests(
        (requestRows || []).map((row) => ({
          id: row.id,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      );
      setProfilesByUserId(
        Object.fromEntries(profiles.map((profile) => [profile.user_id, profile])),
      );
    } catch (caughtError) {
      setError(caughtError?.message || 'Unable to load connection requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const runLoad = async () => {
      await reload();
    };

    void runLoad();
  }, [reload]);

  const getConnectionState = useCallback(
    (otherUserId) => connectionStateForPair(requests, userId, otherUserId),
    [requests, userId],
  );

  const sendRequest = useCallback(
    async (receiverId) => {
      if (!supabase || !userId) {
        throw new Error('You must be signed in to send a connection request.');
      }
      if (receiverId === userId) {
        throw new Error('You cannot connect with yourself.');
      }

      setActionError('');
      const existingState = connectionStateForPair(requests, userId, receiverId);
      if (existingState !== 'none') return existingState;

      try {
        const { data: insertedRequest, error: insertError } = await supabase
          .from('connection_requests')
          .insert({
            sender_id: userId,
            receiver_id: receiverId,
            status: 'pending',
          })
          .select('id, sender_id, receiver_id, status, created_at, updated_at')
          .single();

        if (insertError) throw insertError;
        setRequests((current) => [
          {
            id: insertedRequest.id,
            senderId: insertedRequest.sender_id,
            receiverId: insertedRequest.receiver_id,
            status: insertedRequest.status,
            createdAt: insertedRequest.created_at,
            updatedAt: insertedRequest.updated_at,
          },
          ...current.filter((request) => request.id !== insertedRequest.id),
        ]);
        await reload();
        return 'pending';
      } catch (caughtError) {
        if (caughtError?.code === '23505') {
          await reload();
          try {
            const { data: matchingRows, error: lookupError } = await supabase
              .from('connection_requests')
              .select('sender_id, receiver_id, status')
              .or(
                `and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`,
              );

            if (lookupError) throw lookupError;
            const existing = matchingRows?.[0];
            if (existing?.status === 'accepted') return 'connected';
            if (existing?.status === 'pending') {
              return existing.sender_id === userId ? 'pending' : 'incoming';
            }
          } catch (lookupError) {
            setActionError('Could not send request. Please try again.');
            throw lookupError;
          }
        }

        setActionError('Could not send request. Please try again.');
        throw caughtError;
      }
    },
    [reload, requests, userId],
  );

  const respondToRequest = useCallback(
    async (requestId, status) => {
      if (!supabase || !userId || !['accepted', 'rejected'].includes(status)) {
        throw new Error('This connection request cannot be updated.');
      }

      setBusyRequestId(requestId);
      setActionError('');
      try {
        const { data, error: updateError } = await supabase
          .from('connection_requests')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', requestId)
          .eq('receiver_id', userId)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();

        if (updateError) throw updateError;
        if (!data) throw new Error('This request is no longer pending.');
        setRequests((current) =>
          current.map((request) => (request.id === requestId ? { ...request, status } : request)),
        );
        await reload();
      } catch (caughtError) {
        setActionError('Could not update request. Please try again.');
        throw caughtError;
      } finally {
        setBusyRequestId('');
      }
    },
    [reload, userId],
  );

  const incomingRequests = useMemo(
    () => requests.filter((request) => request.receiverId === userId && request.status === 'pending'),
    [requests, userId],
  );
  const outgoingRequests = useMemo(
    () => requests.filter((request) => request.senderId === userId && request.status === 'pending'),
    [requests, userId],
  );
  const connections = useMemo(
    () => requests.filter((request) => request.status === 'accepted'),
    [requests],
  );

  return {
    requests,
    profilesByUserId,
    incomingRequests,
    outgoingRequests,
    connections,
    loading,
    error,
    actionError,
    busyRequestId,
    getConnectionState,
    sendRequest,
    respondToRequest,
    reload,
  };
}

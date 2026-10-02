import { useCallback, useState } from 'react';
import { useConnectionRequests } from './useConnectionRequests';
import { useDiscoverProfiles } from './useDiscoverProfiles';

export function useProjectRecommendationData(session) {
  const {
    profiles,
    loading: profilesLoading,
    error: profilesError,
    reload: reloadProfiles,
  } = useDiscoverProfiles(session);
  const connections = useConnectionRequests(session);
  const { sendRequest, reload: reloadConnections } = connections;
  const [connectingId, setConnectingId] = useState('');

  const connect = useCallback(async (userId) => {
    setConnectingId(userId);
    try {
      return await sendRequest(userId);
    } catch {
      return null;
    } finally {
      setConnectingId('');
    }
  }, [sendRequest]);

  const reload = useCallback(() => {
    void reloadProfiles();
    void reloadConnections();
  }, [reloadConnections, reloadProfiles]);

  return {
    profiles,
    profilesLoading,
    profilesError,
    connectionLoading: connections.loading,
    connectionError: connections.error,
    actionError: connections.actionError,
    getConnectionState: connections.getConnectionState,
    connect,
    connectingId,
    reload,
  };
}

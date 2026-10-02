import { useCallback, useEffect, useState } from 'react';
import { CometChatUIKit } from '@cometchat/chat-uikit-react';
import { supabase } from '../lib/supabase';

let initializationPromise = null;
let loginPromise = null;
let authenticatedUid = null;
let authenticatedName = null;
let profileSyncPromise = null;

function getErrorMessage(error) {
  return typeof error?.message === 'string' && error.message
    ? error.message
    : 'CometChat could not be initialized. Please try again.';
}

function initializeCometChat() {
  const appId = import.meta.env.VITE_COMETCHAT_APP_ID?.trim();
  const region = import.meta.env.VITE_COMETCHAT_REGION?.trim();

  if (!appId || !region) {
    throw new Error(
      'CometChat is not configured. Set VITE_COMETCHAT_APP_ID and VITE_COMETCHAT_REGION in .env, then restart Vite.',
    );
  }

  if (!initializationPromise) {
    initializationPromise = CometChatUIKit.initFromSettings({
      appId,
      region,
      chatSDK: {
        presenceSubscription: { type: 'ALL_USERS' },
      },
    }).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

async function ensureCometChatUser(uid, name) {
  if (!supabase || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid)) {
    throw new Error('A valid authenticated Supabase user is required for CometChat.');
  }
  await initializeCometChat();

  if (loginPromise) {
    await loginPromise;
  }

  const normalizedUid = uid.toLowerCase();
  if (
    authenticatedUid === normalizedUid &&
    CometChatUIKit.getLoggedInUser()?.getUid() === normalizedUid
  ) {
    if (authenticatedName !== name) {
      if (profileSyncPromise) await profileSyncPromise;
      if (authenticatedName !== name) {
        profileSyncPromise = (async () => {
          const { error } = await supabase.functions.invoke('cometchat-auth-token', {
            method: 'POST',
            body: { name, synchronizeOnly: true },
          });
          if (error) throw error;
          authenticatedName = name;
        })();
        try {
          await profileSyncPromise;
        } finally {
          profileSyncPromise = null;
        }
      }
    }
    return;
  }

  loginPromise = (async () => {
    const currentUser = CometChatUIKit.getLoggedInUser();
    if (currentUser) {
      await CometChatUIKit.logout();
    }
    authenticatedUid = null;
    authenticatedName = null;

    const { data, error } = await supabase.functions.invoke('cometchat-auth-token', {
      method: 'POST',
      body: { name },
    });
    if (error) throw error;
    if (typeof data?.authToken !== 'string' || !data.authToken) {
      throw new Error('CometChat token service returned an invalid response.');
    }

    await CometChatUIKit.loginWithAuthToken(data.authToken);
    if (CometChatUIKit.getLoggedInUser()?.getUid() !== normalizedUid) {
      await CometChatUIKit.logout();
      throw new Error('CometChat login completed without the expected authenticated user.');
    }
    authenticatedUid = normalizedUid;
    authenticatedName = name;
  })();

  try {
    await loginPromise;
  } finally {
    loginPromise = null;
  }
}

export async function logoutCometChat() {
  if (loginPromise) {
    try {
      await loginPromise;
    } catch (error) {
      if (CometChatUIKit.isInitialized() && CometChatUIKit.getLoggedInUser()) {
        throw error;
      }
    }
  }

  if (CometChatUIKit.isInitialized() && CometChatUIKit.getLoggedInUser()) {
    await CometChatUIKit.logout();
  }
  authenticatedUid = null;
  authenticatedName = null;
}

export function useCometChatSession(session, profileName, authLoading) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    userId: '',
    name: '',
    status: 'loading',
    error: '',
  });
  const userId = session?.user?.id;
  const name = profileName ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'HackMate member';

  useEffect(() => {
    if (authLoading) return undefined;

    let isMounted = true;

    if (!userId) {
      void logoutCometChat().catch((error) => {
        if (isMounted) {
          setResult({
            userId: '',
            name: '',
            status: 'error',
            error: getErrorMessage(error),
          });
        }
      });
      return () => {
        isMounted = false;
      };
    }

    void ensureCometChatUser(userId, name)
      .then(() => {
        if (isMounted) setResult({ userId, name, status: 'ready', error: '' });
      })
      .catch((error) => {
        if (isMounted) {
          const userIsLoggedIn = CometChatUIKit.isInitialized() &&
            CometChatUIKit.getLoggedInUser()?.getUid() === userId;
          setResult({
            userId,
            name,
            status: userIsLoggedIn ? 'ready' : 'error',
            error: getErrorMessage(error),
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authLoading, attempt, name, userId]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const state = authLoading
    ? { status: 'loading', error: '' }
    : !userId
      ? { status: 'disabled', error: '' }
      : result.userId === userId && result.status === 'ready'
        ? result
        : result.userId === userId && result.name === name
        ? result
        : { status: 'loading', error: '' };

  return {
    ...state,
    retry,
  };
}

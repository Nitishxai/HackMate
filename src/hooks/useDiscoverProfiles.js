import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function mapDiscoverProfile(row) {
  const skills = (row.profile_skills || [])
    .map((relation) => relation.skills?.name)
    .filter(Boolean);

  return {
    id: row.user_id,
    profileId: row.id,
    name: row.name,
    username: row.username,
    role: row.role || '',
    bio: row.bio || '',
    experience: row.experience || '',
    skills,
    availability: row.availability || '',
    github: row.github_url || '',
    portfolio: row.portfolio_url || '',
    avatarUrl: row.avatar_url || '',
    isPublic: row.is_public === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useDiscoverProfiles(session) {
  const userId = session?.user?.id;
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState('');

  const loadProfiles = useCallback(async () => {
    if (!supabase || !userId) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: profilesError } = await supabase
        .from('profiles')
        .select(
          `
            id,
            user_id,
            name,
            username,
            role,
            bio,
            experience,
            github_url,
            portfolio_url,
            availability,
            avatar_url,
            is_public,
            created_at,
            updated_at,
            profile_skills (
              skill_id,
              skills (name)
            )
          `,
        )
        .eq('is_public', true)
        .neq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (profilesError) {
        throw profilesError;
      }

      setProfiles((data || []).map(mapDiscoverProfile));
    } catch (caughtError) {
      setError(caughtError?.message || 'Unable to load teammates. Please try again.');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const runLoad = async () => {
      await loadProfiles();
    };

    void runLoad();
  }, [loadProfiles]);

  return { profiles, loading, error, reload: loadProfiles };
}

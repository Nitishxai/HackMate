import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PROFILE, normalizeProfile } from '../lib/profileStorage';
import { supabase } from '../lib/supabase';

const emptyProfile = normalizeProfile({ ...DEFAULT_PROFILE, skills: [] });

function buildInitials(name) {
  return (name || DEFAULT_PROFILE.name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getSessionDisplayName(session) {
  return (
    session?.user?.user_metadata?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'HackMate member'
  );
}

function mapProfileRow(row, fallbackName) {
  if (!row) {
    return normalizeProfile({
      ...DEFAULT_PROFILE,
      name: fallbackName,
      role: '',
      bio: '',
      skills: [],
      availability: '',
      experience: '',
    });
  }

  const skillNames = Array.isArray(row.profile_skills)
    ? row.profile_skills
        .map((entry) => entry?.skills?.name)
        .filter(Boolean)
    : [];

  const profile = normalizeProfile({
    name: row.name || fallbackName,
    role: row.role ?? '',
    bio: row.bio ?? '',
    skills: skillNames.map((skill) => ({ name: skill, category: 'Other' })),
    availability: row.availability ?? '',
    experience: row.experience ?? '',
    github: row.github_url || '',
    portfolio: row.portfolio_url || '',
    projects: [],
    interests: [],
    isPublic: row.is_public === true,
    username: row.username || '',
  });

  return {
    ...profile,
    initials: buildInitials(profile.name),
  };
}

export function useProfile(session) {
  const [profile, setProfile] = useState(emptyProfile);
  const [profileUserId, setProfileUserId] = useState('');
  const [loading, setLoading] = useState(Boolean(session));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const loadProfile = useCallback(async () => {
    if (!session?.user?.id || !supabase) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: profileRow, error: fetchError } = await supabase
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
              skills ( name )
            )
          `,
        )
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      const fallbackName = getSessionDisplayName(session);

      if (!profileRow) {
        const username = (fallbackName || 'hackmate-builder')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `user-${session.user.id.slice(0, 8)}`;

        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert([
            {
              user_id: session.user.id,
              name: fallbackName,
              username,
              role: '',
              bio: '',
              experience: '',
              github_url: '',
              portfolio_url: '',
              availability: '',
              avatar_url: null,
              is_public: false,
            },
          ])
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        setProfile(mapProfileRow(createdProfile, fallbackName));
        setProfileUserId(session.user.id);
        return;
      }

      setProfile(mapProfileRow(profileRow, fallbackName));
      setProfileUserId(session.user.id);
    } catch (caughtError) {
      setError(caughtError?.message || 'Unable to load profile.');
      setProfile(emptyProfile);
      setProfileUserId(session.user.id);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const runLoad = async () => {
      await loadProfile();
    };

    void runLoad();
    return undefined;
  }, [session, loadProfile]);

  const updateProfile = useCallback(
    async (nextProfile) => {
      if (!session?.user?.id || !supabase) {
        return normalizeProfile(nextProfile);
      }

      setSaving(true);
      setError('');
      setSaveMessage('');

      try {
        const normalized = normalizeProfile(nextProfile);
        const username = (normalized.name || getSessionDisplayName(session))
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `user-${session.user.id.slice(0, 8)}`;

        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              user_id: session.user.id,
              name: normalized.name,
              username,
              role: normalized.role,
              bio: normalized.bio,
              experience: normalized.experience,
              github_url: normalized.github || null,
              portfolio_url: normalized.portfolio || null,
              availability: normalized.availability,
              avatar_url: null,
              is_public: normalized.isPublic,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )
          .select()
          .single();

        if (profileError) {
          throw profileError;
        }

        const skillNames = [...new Set((normalized.skills || [])
          .map((skill) => (typeof skill === 'string' ? skill : skill.name))
          .map((skill) => skill.trim())
          .filter(Boolean))];

        const { data: existingSkills = [], error: skillLookupError } = await supabase
          .from('skills')
          .select('id, name')
          .in('name', skillNames);

        if (skillLookupError) {
          throw skillLookupError;
        }

        const skillIdMap = new Map(existingSkills.map((skill) => [skill.name.toLowerCase(), skill.id]));
        const missingSkillNames = skillNames.filter((name) => !skillIdMap.has(name.toLowerCase()));

        if (missingSkillNames.length) {
          const { data: insertedSkills = [], error: insertSkillsError } = await supabase
            .from('skills')
            .insert(missingSkillNames.map((name) => ({ name })))
            .select('id, name');

          if (insertSkillsError) {
            throw insertSkillsError;
          }

          insertedSkills.forEach((skill) => {
            skillIdMap.set(skill.name.toLowerCase(), skill.id);
          });
        }

        const finalSkillIds = skillNames
          .map((name) => skillIdMap.get(name.toLowerCase()))
          .filter(Boolean);

        if (profileRow?.id) {
          const { error: deleteError } = await supabase
            .from('profile_skills')
            .delete()
            .eq('profile_id', profileRow.id);

          if (deleteError) {
            throw deleteError;
          }

          if (finalSkillIds.length) {
            const { error: relationError } = await supabase
              .from('profile_skills')
              .insert(
                finalSkillIds.map((skillId) => ({
                  profile_id: profileRow.id,
                  skill_id: skillId,
                })),
              );

            if (relationError) {
              throw relationError;
            }
          }
        }

        const savedProfile = {
          ...normalized,
          initials: buildInitials(normalized.name),
        };

        setProfile(savedProfile);
        setProfileUserId(session.user.id);
        setSaveMessage('Profile saved successfully.');
        return savedProfile;
      } catch (caughtError) {
        const message = caughtError?.message || 'Unable to save profile.';
        setError(message);
        throw caughtError;
      } finally {
        setSaving(false);
      }
    },
    [session],
  );

  return {
    profile: session?.user?.id === profileUserId ? profile : emptyProfile,
    loading: Boolean(session) && (loading || session.user.id !== profileUserId),
    saving,
    error,
    saveMessage,
    updateProfile,
  };
}

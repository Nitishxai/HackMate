import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

function normalizeSkillNames(skillList = []) {
  const names = skillList
    .map((item) => item?.skills?.name || item?.name || item)
    .map((name) => String(name).trim())
    .filter(Boolean);

  return [...new Set(names)];
}

function normalizeProjectRecord(project, profilesByUserId) {
  const acceptedMemberRows = Array.isArray(project.project_members)
    ? project.project_members.filter((member) => member.status === 'accepted')
    : [];
  const hasOwnerMembership = acceptedMemberRows.some((member) => member.user_id === project.owner_id);
  const currentMembers = [
    ...acceptedMemberRows,
    ...(!hasOwnerMembership && project.owner_id
      ? [{ project_id: project.id, user_id: project.owner_id, role: 'owner', status: 'accepted' }]
      : []),
  ].map((member) => {
    const profile = profilesByUserId[member.user_id];
    return {
      ...member,
      name: profile?.name || 'HackMate member',
      profileRole: profile?.role || '',
      skills: normalizeSkillNames(profile?.profile_skills || []),
    };
  });
  const acceptedMembers = currentMembers.length;
  const ownerProfile = profilesByUserId[project.owner_id];

  return {
    id: project.id,
    title: project.title,
    slug: project.slug,
    description: project.description,
    hackathonName: project.hackathon_name || 'Hackathon',
    hackathonUrl: project.hackathon_url || '',
    status: project.status || 'open',
    teamSize: Number(project.team_size) || 1,
    ownerId: project.owner_id || project.owner?.id,
    ownerName: ownerProfile?.name || 'HackMate member',
    ownerRole: ownerProfile?.role || '',
    createdAt: project.created_at,
    skills: normalizeSkillNames(project.project_skills || []),
    acceptedMembers,
    currentMembers,
    openPositions: Math.max((Number(project.team_size) || 1) - acceptedMembers, 0),
  };
}

function normalizeProjectRequest(record, projectById, profilesByUserId) {
  const requester = profilesByUserId[record.requester_id];
  return {
    id: record.id,
    projectId: record.project_id,
    requesterId: record.requester_id,
    message: record.message,
    status: record.status,
    createdAt: record.created_at,
    requesterName: requester?.name || 'HackMate member',
    requesterRole: requester?.role || '',
    requesterSkills: normalizeSkillNames(requester?.profile_skills || []),
    projectTitle: projectById[record.project_id]?.title || 'Project',
    projectOwnerId: projectById[record.project_id]?.owner_id,
  };
}

export function useProjects(session) {
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [skillCatalog, setSkillCatalog] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshProjects = useCallback(() => {
    setRefreshTick((current) => current + 1);
  }, []);

  const loadProjects = useCallback(async () => {
    if (!supabase || !session?.user?.id) {
      setProjects([]);
      setRequests([]);
      setSkillCatalog([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: projectRows, error: projectError } = await supabase
        .from('projects')
        .select(
          `
            id,
            owner_id,
            title,
            slug,
            description,
            hackathon_name,
            hackathon_url,
            status,
            team_size,
            created_at,
            updated_at,
            project_skills ( skill_id, skills (id, name) ),
            project_members ( user_id, role, status, joined_at )
          `,
        )
        .order('created_at', { ascending: false });

      if (projectError) {
        throw projectError;
      }

      const { data: requestRows, error: requestError } = await supabase
        .from('project_requests')
        .select(
          `
            id,
            project_id,
            requester_id,
            message,
            status,
            created_at,
            updated_at
          `,
        )
        .order('created_at', { ascending: false });

      if (requestError) {
        throw requestError;
      }

      const { data: skills, error: skillError } = await supabase
        .from('skills')
        .select('id, name')
        .order('name', { ascending: true });

      if (skillError) {
        throw skillError;
      }

      const projectRowsById = Object.fromEntries(
        (projectRows || []).map((project) => [project.id, project]),
      );
      const profileIds = [...new Set([
        ...(projectRows || []).map((project) => project.owner_id),
        ...(projectRows || []).flatMap((project) =>
          (project.project_members || []).map((member) => member.user_id),
        ),
        ...(requestRows || []).map((request) => request.requester_id),
      ].filter(Boolean))];
      let profileRows = [];

      if (profileIds.length) {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, name, role, profile_skills ( skill_id, skills (name) )')
          .in('user_id', profileIds);

        if (profileError) {
          throw profileError;
        }
        profileRows = data || [];
      }

      const profilesByUserId = Object.fromEntries(
        profileRows.map((profile) => [profile.user_id, profile]),
      );
      setProjects((projectRows || []).map((project) =>
        normalizeProjectRecord(project, profilesByUserId),
      ));
      setRequests((requestRows || []).map((request) =>
        normalizeProjectRequest(request, projectRowsById, profilesByUserId),
      ));
      setSkillCatalog(skills || []);
    } catch (caughtError) {
      setError(caughtError?.message || 'Unable to load project data.');
      setProjects([]);
      setRequests([]);
      setSkillCatalog([]);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const runAsync = async () => {
      await loadProjects();
    };

    void runAsync();
    return undefined;
  }, [session, refreshTick, loadProjects]);

  const createProject = useCallback(
    async ({ title, description, hackathonName, hackathonUrl, teamSize, status, skills }) => {
      if (!supabase || !session?.user?.id) {
        throw new Error('You must be signed in to create a project.');
      }

      const cleanTitle = String(title || '').trim();
      const cleanDescription = String(description || '').trim();
      const cleanSkills = [...new Set((skills || []).map((skill) => String(skill).trim()).filter(Boolean))];
      const numericTeamSize = Number(teamSize) || 1;

      if (!cleanTitle) {
        throw new Error('Project name is required.');
      }

      if (!cleanDescription) {
        throw new Error('Project description is required.');
      }

      if (!cleanSkills.length) {
        throw new Error('Add at least one required skill.');
      }

      if (numericTeamSize < 1) {
        throw new Error('Team size must be at least 1.');
      }

      if (!Number.isInteger(numericTeamSize) || numericTeamSize < 1) {
        throw new Error('Team size must be a whole number greater than 0.');
      }
      if (!['open', 'forming', 'closed'].includes(status || 'open')) {
        throw new Error('Choose a valid project status.');
      }

      const { data: projectId, error: createError } = await supabase.rpc(
        'create_hackathon_project',
        {
          p_title: cleanTitle,
          p_description: cleanDescription,
          p_hackathon_name: hackathonName?.trim() || null,
          p_hackathon_url: hackathonUrl?.trim() || null,
          p_team_size: numericTeamSize,
          p_status: status || 'open',
          p_skills: cleanSkills,
        },
      );

      if (createError) throw createError;

      refreshProjects();
      return projectId;
    },
    [refreshProjects, session],
  );

  const updateProject = useCallback(
    async (projectId, { title, description, hackathonName, hackathonUrl, teamSize, status, skills }) => {
      if (!supabase || !session?.user?.id) {
        throw new Error('You must be signed in to edit a project.');
      }

      const cleanTitle = String(title || '').trim();
      const cleanDescription = String(description || '').trim();
      const cleanSkills = [...new Set((skills || []).map((skill) => String(skill).replace(/\s+/g, ' ').trim()).filter(Boolean))];
      const numericTeamSize = Number(teamSize);
      if (!cleanTitle) throw new Error('Project name is required.');
      if (!cleanDescription) throw new Error('Project description is required.');
      if (!cleanSkills.length) throw new Error('Add at least one required skill.');
      if (!Number.isInteger(numericTeamSize) || numericTeamSize < 1) {
        throw new Error('Team size must be a whole number greater than 0.');
      }
      if (!['open', 'forming', 'closed'].includes(status)) {
        throw new Error('Choose a valid project status.');
      }
      if (hackathonUrl && !/^(https?:\/\/)/i.test(hackathonUrl.trim())) {
        throw new Error('Hackathon URL must be a valid http or https URL.');
      }

      const { data: updatedProjectId, error: updateError } = await supabase.rpc(
        'update_hackathon_project',
        {
          p_project_id: projectId,
          p_title: cleanTitle,
          p_description: cleanDescription,
          p_hackathon_name: hackathonName?.trim() || null,
          p_hackathon_url: hackathonUrl?.trim() || null,
          p_team_size: numericTeamSize,
          p_status: status,
          p_skills: cleanSkills,
        },
      );
      if (updateError) throw updateError;
      if (!updatedProjectId) {
        throw new Error('Project could not be updated. It may have been deleted or you may not own it.');
      }

      refreshProjects();
      return true;
    },
    [refreshProjects, session],
  );

  const deleteProject = useCallback(
    async (projectId) => {
      if (!supabase || !session?.user?.id) {
        throw new Error('You must be signed in to delete a project.');
      }
      const { data: deletedProject, error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('owner_id', session.user.id)
        .select('id')
        .maybeSingle();
      if (deleteError) throw deleteError;
      if (!deletedProject) {
        throw new Error('Project could not be deleted. It may have been deleted or you may not own it.');
      }
      refreshProjects();
      return true;
    },
    [refreshProjects, session],
  );

  const requestToJoin = useCallback(
    async (projectId, message) => {
      if (!supabase || !session?.user?.id) {
        throw new Error('You must be signed in to request to join a project.');
      }

      const cleanedMessage = String(message || '').trim();
      if (!cleanedMessage) {
        throw new Error('A short message is required.');
      }

      const { data: projectRecord, error: projectLookupError } = await supabase
        .from('projects')
        .select('id, owner_id, team_size, status')
        .eq('id', projectId)
        .single();

      if (projectLookupError) {
        throw projectLookupError;
      }

      if (projectRecord.owner_id === session.user.id) {
        throw new Error('You cannot request to join your own project.');
      }
      if (!['open', 'forming'].includes(projectRecord.status)) {
        throw new Error('This project is no longer accepting requests.');
      }

      const { data: existingMember, error: memberLookupError } = await supabase
        .from('project_members')
        .select('user_id, status')
        .eq('project_id', projectId)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (memberLookupError) {
        throw memberLookupError;
      }

      if (existingMember && existingMember.status === 'accepted') {
        throw new Error('You are already a member of this project.');
      }

      const { data: acceptedMembers, error: memberCountError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('status', 'accepted');

      if (memberCountError) throw memberCountError;
      const occupiedPositions =
        (acceptedMembers || []).filter((member) => member.user_id !== projectRecord.owner_id).length + 1;
      if (occupiedPositions >= Number(projectRecord.team_size)) {
        throw new Error('This project is already at full capacity.');
      }

      const { data: existingRequest, error: requestLookupError } = await supabase
        .from('project_requests')
        .select('id, status')
        .eq('project_id', projectId)
        .eq('requester_id', session.user.id)
        .in('status', ['pending', 'accepted'])
        .maybeSingle();

      if (requestLookupError) {
        throw requestLookupError;
      }

      if (existingRequest) {
        throw new Error('You already have a pending request for this project.');
      }

      const { error: requestError } = await supabase
        .from('project_requests')
        .insert([
          {
            project_id: projectId,
            requester_id: session.user.id,
            message: cleanedMessage,
            status: 'pending',
          },
        ]);

      if (requestError) {
        if (requestError.code === '23505') {
          throw new Error('You already have an active request for this project.');
        }
        throw requestError;
      }

      refreshProjects();
      return true;
    },
    [refreshProjects, session],
  );

  const handleProjectRequest = useCallback(
    async (requestId, decision) => {
      if (!supabase || !session?.user?.id) {
        throw new Error('You must be signed in to manage project requests.');
      }
      if (!['accept', 'reject'].includes(decision)) {
        throw new Error('Choose a valid request decision.');
      }

      const targetRequest = requests.find((request) => request.id === requestId);
      if (!targetRequest) {
        throw new Error('Request not found.');
      }

      const { data: projectRecord, error: projectLookupError } = await supabase
        .from('projects')
        .select('id, owner_id, team_size, status')
        .eq('id', targetRequest.projectId)
        .single();

      if (projectLookupError) {
        throw projectLookupError;
      }

      if (projectRecord.owner_id !== session.user.id) {
        throw new Error('Only the project owner can manage requests.');
      }

      if (decision === 'accept') {
        if (!['open', 'forming'].includes(projectRecord.status)) {
          throw new Error('This project is no longer accepting members.');
        }
      }

      const nextStatus = decision === 'accept' ? 'accepted' : 'rejected';
      const { data: updatedRequest, error: updateRequestError } = await supabase
        .from('project_requests')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (updateRequestError) {
        throw updateRequestError;
      }
      if (!updatedRequest) {
        throw new Error('This request is no longer pending. Refresh the project and try again.');
      }

      refreshProjects();
      return true;
    },
    [refreshProjects, requests, session],
  );

  const myProjects = useMemo(
    () => (session ? projects.filter((project) => project.ownerId === session.user.id) : []),
    [projects, session],
  );

  const joinedProjects = useMemo(
    () =>
      session
        ? projects.filter((project) =>
            project.currentMembers.some(
              (member) => member.user_id === session.user.id && member.status === 'accepted',
            ),
          )
        : [],
    [projects, session],
  );

  const openProjects = useMemo(
    () => projects.filter((project) => project.status === 'open' || project.status === 'forming'),
    [projects],
  );

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.requesterId === session?.user?.id && request.status === 'pending'),
    [requests, session],
  );
  const userId = session?.user?.id;

  return {
    projects,
    requests,
    skillCatalog,
    loading,
    error,
    refreshProjects,
    createProject,
    updateProject,
    deleteProject,
    requestToJoin,
    handleProjectRequest,
    myProjects,
    joinedProjects,
    openProjects,
    pendingRequests,
    userId,
  };
}

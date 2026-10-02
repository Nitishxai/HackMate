export function buildRecentActivity(
  projects = [],
  connections = [],
  currentUserId,
  joinedProjects = [],
  profilesByUserId = {},
) {
  const events = [];

  projects.forEach((project) => {
    if (!project.createdAt) return;
    events.push({
      id: `project-created-${project.id}`,
      label: `You created "${project.title}".`,
      createdAt: project.createdAt,
      type: 'project',
    });
  });

  joinedProjects.forEach((project) => {
    const membership = project.currentMembers.find(
      (member) => member.user_id === currentUserId && member.status === 'accepted',
    );
    if (!membership?.joined_at || project.ownerId === currentUserId) return;
    events.push({
      id: `project-joined-${project.id}`,
      label: `You joined "${project.title}".`,
      createdAt: membership.joined_at,
      type: 'team',
    });
  });

  connections.forEach((request) => {
    const outgoing = request.senderId === currentUserId;
    const otherId = outgoing ? request.receiverId : request.senderId;
    const other = profilesByUserId[otherId];
    const displayName = other?.username ? `@${other.username}` : other?.name || 'a teammate';
    if (request.status === 'accepted') {
      events.push({
        id: `connection-accepted-${request.id}`,
        label: `You connected with ${displayName}.`,
        createdAt: request.updatedAt || request.createdAt,
        type: 'connection',
      });
    } else if (request.status === 'pending') {
      events.push({
        id: `connection-pending-${request.id}`,
        label: outgoing
          ? `You sent a connection request to ${displayName}.`
          : `${displayName} sent you a connection request.`,
        createdAt: request.createdAt,
        type: 'request',
      });
    }
  });

  return events
    .filter((event) => event.createdAt && Number.isFinite(Date.parse(event.createdAt)))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 6);
}

export function formatActivityDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

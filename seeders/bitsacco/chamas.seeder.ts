import { User, Chama, ChamaMember, ChamaMemberRole } from './types';
import { generateId, randomSelect } from '../utils';

/**
 * Seed chamas
 * @param users Array of users to assign to chamas
 * @returns Array of seeded chamas
 */
export async function seedChamas(users: User[]): Promise<Chama[]> {
  const chamas: Chama[] = [];

  // Utility function to create a chama member with specific roles
  const createChamaMember = (
    user: User,
    roles: ChamaMemberRole[],
  ): ChamaMember => ({
    user_id: user.id,
    roles,
  });

  // Find admin users
  const adminUsers = users.filter((user) => user.roles.includes(1)); // Role.Admin

  // Create first chama (Savings Group) - all users are members, admin is creator
  const creator1 = adminUsers[0];
  const chama1Members: ChamaMember[] = [
    // Creator is admin
    createChamaMember(creator1, [
      ChamaMemberRole.Admin,
      ChamaMemberRole.Member,
    ]),
  ];

  // Add all other users as members
  users.forEach((user) => {
    if (user.id !== creator1.id) {
      chama1Members.push(createChamaMember(user, [ChamaMemberRole.Member]));
    }
  });

  chamas.push({
    id: generateId(),
    name: 'Savings Group',
    description: 'A general savings group for all members',
    members: chama1Members,
    created_by: creator1.id,
  });

  // Create second chama (Investment Club) - subset of users, with multiple admins
  const creator2 = adminUsers.length > 1 ? adminUsers[1] : adminUsers[0];
  const investmentMembers = randomSelect(users, 5);

  // Ensure creator is in the list
  if (!investmentMembers.some((m) => m.id === creator2.id)) {
    investmentMembers.push(creator2);
  }

  // Add another admin if available
  const otherAdmin = adminUsers.find(
    (admin) =>
      admin.id !== creator2.id &&
      !investmentMembers.some((m) => m.id === admin.id),
  );

  if (otherAdmin) {
    investmentMembers.push(otherAdmin);
  }

  const chama2Members: ChamaMember[] = investmentMembers.map((user) => {
    // Determine roles based on user
    if (user.id === creator2.id || (otherAdmin && user.id === otherAdmin.id)) {
      return createChamaMember(user, [
        ChamaMemberRole.Admin,
        ChamaMemberRole.Member,
      ]);
    } else {
      return createChamaMember(user, [ChamaMemberRole.Member]);
    }
  });

  chamas.push({
    id: generateId(),
    name: 'Investment Club',
    description: 'Group for investing in various opportunities',
    members: chama2Members,
    created_by: creator2.id,
  });

  // Create third chama (Project Fund) - different subset of users
  const remainingUsers = users.filter(
    (user) =>
      !investmentMembers.some((m) => m.id === user.id) || Math.random() < 0.3,
  );

  // Pick a creator
  const creator3 =
    adminUsers.find((admin) => remainingUsers.some((u) => u.id === admin.id)) ||
    remainingUsers[0];

  // Ensure we have at least 3 members
  const projectMembers = randomSelect(
    remainingUsers.filter((u) => u.id !== creator3.id),
    Math.min(remainingUsers.length - 1, 2),
  );

  projectMembers.push(creator3);

  const chama3Members: ChamaMember[] = projectMembers.map((user) => {
    if (user.id === creator3.id) {
      return createChamaMember(user, [
        ChamaMemberRole.Admin,
        ChamaMemberRole.Member,
      ]);
    } else {
      return createChamaMember(user, [ChamaMemberRole.Member]);
    }
  });

  chamas.push({
    id: generateId(),
    name: 'Project Fund',
    description: 'Pooled resources for specific project',
    members: chama3Members,
    created_by: creator3.id,
  });

  // Create seed database records
  // This is where you would normally insert these records into your database
  // For now, we just return the generated chamas

  return chamas;
}

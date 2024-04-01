import { Role, RoleSetting, User } from "../models/models";

export function resetRoles(users: User[]): User[]{
  for (let i = 0; i < users.length; i++) {
    users[i].role = undefined;
    users[i].opened = undefined;
    users[i].position = undefined;
  }

  return users;
}

export function assignRoles(players: User[], settings: RoleSetting[]): User[] {
  if (!players || !players.length) {
    throw new Error('Here no players.');
  }

  if (!settings || !settings.length) {
    throw new Error('Here no settings.');
  }
  
  if (players.length !== settings.map(x=>x.amount).reduce((a, b) => a + b, 0)) {
    throw new Error('The length of users and settings must be the same.');
  }

  const roles: Role[] = [];
  for (const setting of settings) {
    for (let i = 0; i < setting.amount; i++) {
      roles.push(setting.role);
      if (setting.role === 'boss') {
        roles.push('mafia');
      }
    }
  }

  shuffleArray(roles);

  const result: User[] = [];
  for (let i = 0; i < players.length; i++) {
    result.push({
      ...players[i],
    });
    result[i].role = [roles[i]];
    result[i].finished = false;
    result[i].position = i + 1;
  }

  return result;
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

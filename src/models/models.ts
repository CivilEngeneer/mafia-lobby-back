export type UserType = 'master' | 'player' | 'observer';
export type Role = 'mafia' | 'don' | 'citizen' | 'commissar' | 'doctor' | 'lady' | 'maniac';

export interface User {
  id: string;
  position?: number;
  name: string;
  type: UserType;
  role?: Role[];
  opened?: boolean;
  online?: boolean;
}

export interface Game {
  id: string;
  users: User[];
  roleSettings: RoleSetting[];
  state: 'new' | 'inProcess';
}

export type RoleSetting = { role: Role, amount: number };

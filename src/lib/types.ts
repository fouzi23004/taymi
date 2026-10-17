import type { Database, Enums, Tables, TablesInsert, TablesUpdate } from './database.types'

export type Role = Enums<'app_role'>
export type Profile = Tables<'profiles'>
export type Client = Tables<'clients'>
export type Category = Tables<'categories'>
export type ClientCategory = Tables<'client_categories'>
export type Exercise = Tables<'exercises'>
export type Task = Tables<'tasks'>
export type TimeEntry = Tables<'time_entries'>
export type ClientInput = TablesInsert<'clients'> & TablesUpdate<'clients'>
export type CategoryInput = TablesInsert<'categories'> & TablesUpdate<'categories'>
export type ExerciseInput = TablesInsert<'exercises'> & TablesUpdate<'exercises'>
export type TaskInput = TablesInsert<'tasks'> & TablesUpdate<'tasks'>
export type RollupRow = Database['public']['Functions']['report_rollup']['Returns'][number]

export const ROLES: Role[] = ['admin', 'manager', 'collaborator']
export const isStaff = (role?: Role | null) => role === 'admin' || role === 'manager'

/**
 * People expected to log time every working day. Admins usually don't, so they
 * only count once they have logged something.
 */
export const logsTime = (p: Profile) => p.active && p.role !== 'admin'

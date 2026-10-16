import type { Database, Enums, Tables, TablesInsert, TablesUpdate } from './database.types'

export type Role = Enums<'app_role'>
export type Profile = Tables<'profiles'>
export type Client = Tables<'clients'>
export type Task = Tables<'tasks'>
export type TimeEntry = Tables<'time_entries'>
export type ClientInput = TablesInsert<'clients'> & TablesUpdate<'clients'>
export type TaskInput = TablesInsert<'tasks'> & TablesUpdate<'tasks'>
export type RollupRow = Database['public']['Functions']['report_rollup']['Returns'][number]

export const ROLES: Role[] = ['admin', 'manager', 'collaborator']
export const isStaff = (role?: Role | null) => role === 'admin' || role === 'manager'

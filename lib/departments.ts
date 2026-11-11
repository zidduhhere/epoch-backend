export const DEPARTMENTS = ['CSE', 'AIML', 'EEE', 'ECE', 'AERO', 'MECH', 'MECHT', 'CIVIL'] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const YEARS = [1, 2, 3, 4] as const;

/** MECHT runs for three years; every other department runs for four. */
export function departmentHasYear(department: string, year: number): boolean {
  return department === 'MECHT' ? year <= 3 : year <= 4;
}

export const TEAM_NAME = 'КАБАНЫ ЕСПОРТС';

export function normalizeTeamName(text: string): string {
  return text.replace(/(^|[^\p{L}\p{N}_])(?:team[ \t]+)?(?:kab6anbl|ka6ahbl|ka6anbl|kabany)(?:[ \t]+esports?)?(?![\p{L}\p{N}_])/giu, (_match, prefix: string) => `${prefix}${TEAM_NAME}`);
}

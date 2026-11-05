import type {
  ProactiveCommunicationPreferences,
  ProactiveTrigger,
} from './types';

function parseMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isWithinAllowedTime(
  preferences: ProactiveCommunicationPreferences,
  now: Date,
): boolean {
  const start = parseMinutes(preferences.allowedStart);
  const end = parseMinutes(preferences.allowedEnd);
  if (start === null || end === null || start === end) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export function canSendProactivePrompt({
  preferences,
  trigger,
  now = new Date(),
  promptsSentToday,
}: {
  preferences: ProactiveCommunicationPreferences;
  trigger: ProactiveTrigger;
  now?: Date;
  promptsSentToday: number;
}): boolean {
  if (!preferences.enabled) return false;
  if (preferences.promptsPerDay <= 0) return false;
  if (promptsSentToday >= preferences.promptsPerDay) return false;
  if (!isWithinAllowedTime(preferences, now)) return false;

  if (trigger === 'upcoming-schedule' && !preferences.reminders.upcomingSchedules) {
    return false;
  }
  if (trigger === 'incomplete-task' && !preferences.reminders.incompleteTasks) {
    return false;
  }

  return true;
}

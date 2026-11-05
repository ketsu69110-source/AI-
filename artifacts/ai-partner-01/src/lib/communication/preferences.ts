import {
  DEFAULT_COMMUNICATION_PREFERENCES,
  type CommunicationPreferences,
  type VoiceInputMode,
} from './types';

const PREFERENCES_KEY = 'ai-partner-01:communication-preferences:v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function loadCommunicationPreferences(): CommunicationPreferences {
  if (typeof window === 'undefined') return DEFAULT_COMMUNICATION_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_COMMUNICATION_PREFERENCES;

    const stored: unknown = JSON.parse(raw);
    if (!isRecord(stored)) return DEFAULT_COMMUNICATION_PREFERENCES;

    const voice = isRecord(stored.voice) ? stored.voice : {};
    const proactive = isRecord(stored.proactive) ? stored.proactive : {};
    const reminders = isRecord(proactive.reminders) ? proactive.reminders : {};
    const mode: VoiceInputMode =
      voice.inputMode === 'wake-word' ? 'wake-word' : 'push-to-talk';

    return {
      voice: {
        inputEnabled:
          typeof voice.inputEnabled === 'boolean'
            ? voice.inputEnabled
            : DEFAULT_COMMUNICATION_PREFERENCES.voice.inputEnabled,
        inputMode: mode,
        wakePhrase:
          typeof voice.wakePhrase === 'string'
            ? voice.wakePhrase
            : DEFAULT_COMMUNICATION_PREFERENCES.voice.wakePhrase,
        readRepliesAloud:
          typeof voice.readRepliesAloud === 'boolean'
            ? voice.readRepliesAloud
            : DEFAULT_COMMUNICATION_PREFERENCES.voice.readRepliesAloud,
      },
      proactive: {
        enabled:
          typeof proactive.enabled === 'boolean'
            ? proactive.enabled
            : DEFAULT_COMMUNICATION_PREFERENCES.proactive.enabled,
        allowedStart: isTime(proactive.allowedStart)
          ? proactive.allowedStart
          : DEFAULT_COMMUNICATION_PREFERENCES.proactive.allowedStart,
        allowedEnd: isTime(proactive.allowedEnd)
          ? proactive.allowedEnd
          : DEFAULT_COMMUNICATION_PREFERENCES.proactive.allowedEnd,
        promptsPerDay:
          typeof proactive.promptsPerDay === 'number' &&
          Number.isInteger(proactive.promptsPerDay) &&
          proactive.promptsPerDay >= 0
            ? proactive.promptsPerDay
            : DEFAULT_COMMUNICATION_PREFERENCES.proactive.promptsPerDay,
        reminders: {
          upcomingSchedules:
            typeof reminders.upcomingSchedules === 'boolean'
              ? reminders.upcomingSchedules
              : DEFAULT_COMMUNICATION_PREFERENCES.proactive.reminders.upcomingSchedules,
          incompleteTasks:
            typeof reminders.incompleteTasks === 'boolean'
              ? reminders.incompleteTasks
              : DEFAULT_COMMUNICATION_PREFERENCES.proactive.reminders.incompleteTasks,
        },
      },
    };
  } catch {
    return DEFAULT_COMMUNICATION_PREFERENCES;
  }
}

export function saveCommunicationPreferences(
  preferences: CommunicationPreferences,
): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Keep current-session controls usable if browser storage is unavailable.
  }
}

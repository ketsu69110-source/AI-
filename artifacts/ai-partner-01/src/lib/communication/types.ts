export type VoiceInputMode = 'push-to-talk' | 'wake-word';

export type ConversationSource =
  | 'text'
  | 'push-to-talk'
  | 'wake-word'
  | 'scheduled'
  | 'task-reminder'
  | 'schedule-reminder';

export type ProactiveTrigger = 'upcoming-schedule' | 'incomplete-task';

export type ProactiveCommunicationPreferences = {
  enabled: boolean;
  allowedStart: string;
  allowedEnd: string;
  promptsPerDay: number;
  reminders: {
    upcomingSchedules: boolean;
    incompleteTasks: boolean;
  };
};

export type CommunicationPreferences = {
  voice: {
    inputEnabled: boolean;
    inputMode: VoiceInputMode;
    wakePhrase: string;
    readRepliesAloud: boolean;
  };
  proactive: ProactiveCommunicationPreferences;
};

export const DEFAULT_COMMUNICATION_PREFERENCES: CommunicationPreferences = {
  voice: {
    inputEnabled: true,
    inputMode: 'push-to-talk',
    wakePhrase: 'ねえ、ミオ',
    readRepliesAloud: true,
  },
  proactive: {
    enabled: false,
    allowedStart: '09:00',
    allowedEnd: '21:00',
    promptsPerDay: 2,
    reminders: {
      upcomingSchedules: true,
      incompleteTasks: true,
    },
  },
};

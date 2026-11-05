import type { ChatMessage, Task } from './types';

const TASKS_KEY = 'ai-partner-01:tasks';
const CHAT_KEY = 'ai-partner-01:chat';

const starterTasks: Task[] = [
  { id: 'starter-task-1', title: '今日の予定を確認する', completed: true, createdAt: new Date().toISOString() },
  { id: 'starter-task-2', title: 'メールに返信する', completed: false, createdAt: new Date().toISOString() },
  { id: 'starter-task-3', title: '帰りに牛乳を買う', completed: false, createdAt: new Date().toISOString() },
];

const starterMessages: ChatMessage[] = [
  { id: 'starter-chat-1', role: 'assistant', text: 'おはようございます。今日もそばにいます。まずは、ひとつずつ進めていきましょう。', createdAt: new Date().toISOString() },
  { id: 'starter-chat-2', role: 'user', text: '今日のタスクを整理したいな', createdAt: new Date().toISOString() },
  { id: 'starter-chat-3', role: 'assistant', text: 'いいですね。やることを送ってくれたら、一緒に確認します。', createdAt: new Date().toISOString() },
];

function read<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadTasks(): Task[] {
  return read(TASKS_KEY, starterTasks);
}

export function saveTasks(tasks: Task[]): void {
  try {
    window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // Storage may be unavailable in private browsing; the app remains usable in memory.
  }
}

export function loadMessages(): ChatMessage[] {
  return read(CHAT_KEY, starterMessages);
}

export function saveMessages(messages: ChatMessage[]): void {
  try {
    window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  } catch {
    // Storage may be unavailable in private browsing; the app remains usable in memory.
  }
}

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};

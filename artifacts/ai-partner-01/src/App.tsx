import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Check, CheckCheck, ListTodo, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { createLocalReply } from './lib/mockReply';
import { loadMessages, loadTasks, saveMessages, saveTasks } from './lib/storage';
import type { ChatMessage, Task } from './lib/types';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Home() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [taskDraft, setTaskDraft] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveMessages(messages), [messages]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskDraft.trim();
    if (!title) return;
    const task: Task = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((current) => [task, ...current]);
    setTaskDraft('');
  }

  function toggleTask(id: string) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task));
  }

  function deleteTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageDraft.trim();
    if (!text) return;
    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      createdAt: now,
    };
    const answer: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: createLocalReply(text),
      createdAt: new Date(Date.now() + 1).toISOString(),
    };
    setMessages((current) => [...current, userMessage, answer]);
    setMessageDraft('');
  }

  function timeLabel(value: string) {
    return new Date(value).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><Sparkles size={19} strokeWidth={1.8} /></div>
          <div>
            <div className="brand-title">AI PARTNER 01</div>
            <div className="brand-subtitle">毎日に寄り添うパートナー</div>
          </div>
        </div>
        <div className="system-state" data-testid="status-connection"><span className="state-dot" />いつでもそばにいます</div>
      </header>

      <div className="main-grid">
        <div className="left-column">
          <section className="identity-card" aria-label="AIパートナー">
            <span className="orbital-label">パートナーモデル / 01</span>
            <div className="robot" data-testid="visual-partner-face" role="img" aria-label="水色の目をしたAIロボットの顔">
              <div className="robot-halo" />
              <div className="robot-head">
                <span className="robot-ear left" /><span className="robot-ear right" />
                <div className="face-panel"><span className="face-glint" /><span className="eye" /><span className="eye" /></div>
                <span className="robot-light" />
              </div>
              <div className="robot-neck" />
            </div>
            <h1 className="identity-name" data-testid="text-partner-name">ミオ</h1>
            <p className="identity-caption">あなたの毎日に寄り添う AI パートナー</p>
            <div className="identity-tag"><span className="tag-light" />会話とタスクをサポート</div>
          </section>

          <section className="section-card progress-card-shell" aria-labelledby="progress-title">
            <div className="section-heading">
              <h2 className="heading-title" id="progress-title"><span className="heading-icon"><CheckCheck size={16} /></span>今日の進み具合</h2>
              <span className="eyebrow">今日</span>
            </div>
            <div className="progress-card">
              <div className="progress-ring" style={{ '--progress': `${progress}%` } as CSSProperties} data-testid="visual-task-progress">
                <div className="progress-inner" data-testid="text-progress-rate">{progress}%</div>
              </div>
              <div className="progress-copy">
                <strong data-testid="text-completion-summary">{completedCount} / {tasks.length} 件完了</strong>
                <span>{tasks.length === 0 ? 'タスクを追加して始めましょう' : completedCount === tasks.length ? '今日のタスクはすべて完了です' : '自分のペースで進めましょう'}</span>
              </div>
              <div className="progress-stats">
                <strong data-testid="text-completed-count">{completedCount}</strong>
                <span>完了</span>
              </div>
            </div>
          </section>
        </div>

        <section className="section-card chat-panel" aria-labelledby="chat-title">
          <header className="chat-header">
            <div>
              <h2 className="heading-title" id="chat-title"><span className="heading-icon"><Sparkles size={16} /></span>ミオと話す</h2>
            </div>
            <div className="assistant-status" data-testid="status-assistant"><span className="state-dot" />オンライン</div>
          </header>
          <div className="chat-body" role="log" aria-live="polite" aria-label="会話履歴" data-testid="list-chat-messages">
            <p className="day-label">今日の会話</p>
            {messages.length === 0 ? (
              <div className="empty-chat" data-testid="empty-chat">ここから会話を始めましょう。<br />今日のこと、なんでも聞かせてください。</div>
            ) : messages.map((message) => (
              <div className={`message-row ${message.role}`} key={message.id} data-testid={`message-${message.role}-${message.id}`}>
                <span className="message-avatar" aria-hidden="true">{message.role === 'assistant' ? 'ミオ' : 'あなた'}</span>
                <div className="message-content">
                  <div className="message-bubble" data-testid={`text-message-${message.id}`}>{message.text}</div>
                  <time className="message-time" dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <footer className="chat-footer">
            <form className="chat-form" onSubmit={sendMessage}>
              <input
                className="chat-input"
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="ミオに話しかける..."
                aria-label="メッセージ"
                data-testid="input-chat-message"
              />
              <button className="send-button" type="submit" aria-label="メッセージを送信" disabled={!messageDraft.trim()} data-testid="button-send-message"><Send size={16} /></button>
            </form>
            <p className="chat-hint">この会話はこの端末に保存されます</p>
          </footer>
        </section>
      </div>

      <section className="section-card tasks-card" aria-labelledby="tasks-title">
        <div className="section-heading">
          <h2 className="heading-title" id="tasks-title"><span className="heading-icon"><ListTodo size={16} /></span>今日のタスク</h2>
          <span className="task-count" data-testid="text-task-count">{tasks.length} 件</span>
        </div>
        <form className="task-form" onSubmit={addTask}>
          <input
            className="task-input"
            value={taskDraft}
            onChange={(event) => setTaskDraft(event.target.value)}
            placeholder="新しいタスクを入力"
            aria-label="新しいタスク"
            data-testid="input-new-task"
          />
          <button className="add-button" type="submit" disabled={!taskDraft.trim()} data-testid="button-add-task"><Plus size={15} />追加</button>
        </form>
        {tasks.length === 0 ? (
          <div className="empty-tasks" data-testid="empty-tasks">タスクはまだありません。<br />小さなことから追加してみましょう。</div>
        ) : (
          <ul className="task-list" data-testid="list-tasks">
            {tasks.map((task) => (
              <li className="task-row" key={task.id} data-testid={`row-task-${task.id}`}>
                <button
                  className={`task-check${task.completed ? ' checked' : ''}`}
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  aria-label={task.completed ? `${task.title}を未完了にする` : `${task.title}を完了にする`}
                  aria-pressed={task.completed}
                  data-testid={`button-toggle-task-${task.id}`}
                >{task.completed && <Check size={13} strokeWidth={2.6} />}</button>
                <span className={`task-title${task.completed ? ' done' : ''}`} data-testid={`text-task-title-${task.id}`}>{task.title}</span>
                <time className="task-time" dateTime={task.createdAt} data-testid={`text-task-time-${task.id}`}>{timeLabel(task.createdAt)}</time>
                <button className="delete-task" type="button" onClick={() => deleteTask(task.id)} aria-label={`${task.title}を削除`} data-testid={`button-delete-task-${task.id}`}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <footer className="footer-note">
        <span className="footer-mark"><span className="footer-line" />AI PARTNER 01</span>
        <span>小さな一歩を、いっしょに。</span>
      </footer>
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

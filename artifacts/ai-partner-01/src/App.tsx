import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Check, CheckCheck, ListTodo, Mic, MicOff, Plus, Send, Settings2, Sparkles, Square, Trash2 } from 'lucide-react';
import { getWeather } from '@workspace/api-client-react';
import { VoiceSettingsPanel } from './components/voice-settings';
import { createLocalReply } from './lib/mockReply';
import { formatWeatherReply, parseWeatherIntent } from './lib/weather-intent';
import {
  loadCommunicationPreferences,
  saveCommunicationPreferences,
} from './lib/communication/preferences';
import type {
  CommunicationPreferences,
  ConversationEmotion,
  ConversationSource,
} from './lib/communication/types';
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  type SpeechRecognitionSession,
} from './lib/speech/recognition';
import {
  browserSpeechOutput,
  isSpeechSynthesisSupported,
  type SpeechVoiceOption,
} from './lib/speech/synthesis';
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
  const [communicationPreferences, setCommunicationPreferences] = useState(loadCommunicationPreferences);
  const [taskDraft, setTaskDraft] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('');
  const [availableVoices, setAvailableVoices] = useState<SpeechVoiceOption[]>(() => browserSpeechOutput.listJapaneseVoices());
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [supportsRecognition] = useState(isSpeechRecognitionSupported);
  const [supportsSynthesis] = useState(isSpeechSynthesisSupported);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionSession | null>(null);
  const recognitionBaseRef = useRef('');
  const recognitionFailedRef = useRef(false);
  const speechSessionRef = useRef(0);
  const messageSourceRef = useRef<ConversationSource>('text');
  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveMessages(messages), [messages]);
  useEffect(() => saveCommunicationPreferences(communicationPreferences), [communicationPreferences]);
  useEffect(() => {
    if (!supportsSynthesis) return;
    const refreshVoices = () => setAvailableVoices(browserSpeechOutput.listJapaneseVoices());
    refreshVoices();
    const unsubscribe = browserSpeechOutput.subscribeVoicesChanged(refreshVoices);
    const delayedRefreshes = [
      window.setTimeout(refreshVoices, 300),
      window.setTimeout(refreshVoices, 1200),
    ];
    return () => {
      unsubscribe();
      delayedRefreshes.forEach(window.clearTimeout);
    };
  }, [supportsSynthesis]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);
  useEffect(() => () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    browserSpeechOutput.stop();
  }, []);

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

  function updateVoiceSettings(patch: Partial<CommunicationPreferences['voice']>) {
    if (patch.inputEnabled === false && recognitionRef.current) {
      const activeRecognition = recognitionRef.current;
      recognitionRef.current = null;
      activeRecognition.abort();
      setIsListening(false);
      setSpeechStatus('マイク入力をOFFにしました。');
    }
    if (patch.readRepliesAloud === false) {
      speechSessionRef.current += 1;
      browserSpeechOutput.stop();
      setIsSpeaking(false);
      setSpeechStatus('返答の読み上げをOFFにしました。');
    }
    setCommunicationPreferences((current) => ({
      ...current,
      voice: { ...current.voice, ...patch },
    }));
  }

  function playAssistantText(text: string, emotion: ConversationEmotion): boolean {
    if (!supportsSynthesis) return false;
    const speechSession = ++speechSessionRef.current;
    const started = browserSpeechOutput.speak(
      text,
      communicationPreferences.voice,
      emotion,
      {
        onStart: () => {
          if (speechSessionRef.current === speechSession) {
            setIsSpeaking(true);
            setSpeechStatus('ミオが話しています。');
          }
        },
        onEnd: () => {
          if (speechSessionRef.current === speechSession) {
            setIsSpeaking(false);
            setSpeechStatus('');
          }
        },
        onError: () => {
          if (speechSessionRef.current === speechSession) {
            setIsSpeaking(false);
            setSpeechStatus('音声を再生できませんでした。返答は画面で確認できます。');
          }
        },
      },
    );
    if (!started) {
      setIsSpeaking(false);
      setSpeechStatus('音声を再生できませんでした。返答は画面で確認できます。');
    }
    return started;
  }

  function appendAssistantReply(
    text: string,
    source: ConversationSource,
    emotion: ConversationEmotion = 'warm',
  ) {
    const answer: ChatMessage = {
      id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      text,
      createdAt: new Date().toISOString(),
      source,
      emotion,
    };
    setMessages((current) => [...current, answer]);
    if (communicationPreferences.voice.readRepliesAloud) {
      playAssistantText(answer.text, answer.emotion ?? 'warm');
    }
  }

  function weatherFailureMessage(error: unknown, location: string, dateLabel: string): string {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined;
    if (status === 404) {
      return `「${location}」の場所、または${dateLabel}の予報が見つからなかったよ。地域名や日付を変えて試してみてね。`;
    }
    return '天気情報を取得できなかったよ。通信状況を確認して、少し時間をおいてもう一度試してね。';
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageDraft.trim();
    if (!text || isWeatherLoading) return;
    const activeRecognition = recognitionRef.current;
    if (activeRecognition) {
      recognitionRef.current = null;
      recognitionFailedRef.current = true;
      setIsListening(false);
      activeRecognition.stop();
    }
    const now = new Date().toISOString();
    const source = messageSourceRef.current;
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      createdAt: now,
      source,
    };

    const weatherIntent = parseWeatherIntent(text);
    if (weatherIntent) {
      setMessages((current) => [...current, userMessage]);
      setMessageDraft('');
      messageSourceRef.current = 'text';
      setSpeechStatus('');

      if (!weatherIntent.location) {
        appendAssistantReply(
          `${weatherIntent.dateLabel}の天気を調べるね。どの地域の天気が知りたい？市区町村名を教えてね。`,
          source,
          'explanatory',
        );
        return;
      }

      setIsWeatherLoading(true);
      void getWeather({
        location: weatherIntent.location,
        date: weatherIntent.date,
      }).then((forecast) => {
        appendAssistantReply(
          formatWeatherReply(forecast, weatherIntent.dateLabel),
          source,
          'explanatory',
        );
      }).catch((error: unknown) => {
        appendAssistantReply(
          weatherFailureMessage(error, weatherIntent.location ?? '', weatherIntent.dateLabel),
          source,
          'concerned',
        );
      }).finally(() => {
        setIsWeatherLoading(false);
      });
      return;
    }

    const reply = createLocalReply(text, messages, tasks);
    const answer: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: reply.text,
      createdAt: new Date(Date.now() + 1).toISOString(),
      source,
      emotion: reply.emotion,
    };
    setMessages((current) => [...current, userMessage, answer]);
    setMessageDraft('');
    messageSourceRef.current = 'text';
    setSpeechStatus('');
    if (communicationPreferences.voice.readRepliesAloud) {
      playAssistantText(answer.text, answer.emotion ?? 'warm');
    }
  }

  function toggleSpeechRecognition() {
    if (!supportsRecognition || !communicationPreferences.voice.inputEnabled) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    speechSessionRef.current += 1;
    browserSpeechOutput.stop();
    setIsSpeaking(false);
    recognitionFailedRef.current = false;
    recognitionBaseRef.current = messageDraft.trim();
    setSpeechStatus('マイクの使用許可を確認しています。');

    let session: SpeechRecognitionSession | null = null;
    session = createSpeechRecognition({
      lang: 'ja-JP',
      continuous: true,
      interimResults: true,
      onStart: () => {
        if (session && recognitionRef.current === session) {
          setIsListening(true);
          setSpeechStatus('聞いています。話し終えたらマイクをもう一度押してください。');
        }
      },
      onResult: ({ finalTranscript, interimTranscript }) => {
        if (!session || recognitionRef.current !== session) return;
        const spokenText = `${finalTranscript}${interimTranscript}`.trim();
        const baseText = recognitionBaseRef.current;
        if (spokenText) messageSourceRef.current = 'push-to-talk';
        setMessageDraft([baseText, spokenText].filter(Boolean).join(baseText && spokenText ? ' ' : ''));
      },
      onError: (error) => {
        if (!session || recognitionRef.current !== session) return;
        recognitionFailedRef.current = true;
        setIsListening(false);
        setSpeechStatus(getRecognitionErrorMessage(error));
      },
      onEnd: () => {
        if (!session || recognitionRef.current !== session) return;
        recognitionRef.current = null;
        setIsListening(false);
        if (!recognitionFailedRef.current) {
          setSpeechStatus('認識した内容を確認して、送信してください。');
        }
      },
    });

    if (!session) {
      setSpeechStatus('このブラウザでは音声入力を開始できません。文字で入力できます。');
      return;
    }

    recognitionRef.current = session;
    try {
      session.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setSpeechStatus('音声入力を開始できませんでした。ブラウザのマイク設定をご確認ください。');
    }
  }

  function stopSpokenReply() {
    speechSessionRef.current += 1;
    browserSpeechOutput.stop();
    setIsSpeaking(false);
    setSpeechStatus('読み上げを停止しました。');
  }

  function getRecognitionErrorMessage(error: string): string {
    switch (error) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'マイクまたは音声認識が許可されていません。サイトのマイク設定をご確認ください。iPad SafariではSiriの設定もご確認ください。';
      case 'audio-capture':
        return 'マイクを利用できません。マイクの接続や設定をご確認ください。';
      case 'no-speech':
        return '声を認識できませんでした。もう一度お試しください。';
      case 'network':
        return '音声認識サービスに接続できません。文字入力をお使いください。';
      default:
        return '音声入力を続けられませんでした。文字入力をお使いください。';
    }
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
            <div className="chat-header-tools">
              <div className="assistant-status" data-testid="status-assistant"><span className="state-dot" />オンライン</div>
              <button
                className="voice-settings-toggle"
                type="button"
                onClick={() => setShowVoiceSettings((current) => !current)}
                aria-expanded={showVoiceSettings}
                aria-controls="voice-settings-panel"
                data-testid="button-open-voice-settings"
              ><Settings2 size={15} />音声設定</button>
            </div>
          </header>
          {showVoiceSettings && (
            <VoiceSettingsPanel
              settings={communicationPreferences.voice}
              voices={availableVoices}
              supported={supportsSynthesis}
              onChange={updateVoiceSettings}
              onPreview={() => playAssistantText('こんにちは。今日はどんな一日にしましょう？', 'warm')}
              onRefreshVoices={() => setAvailableVoices(browserSpeechOutput.listJapaneseVoices())}
              onClose={() => setShowVoiceSettings(false)}
            />
          )}
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
                onChange={(event) => {
                  setMessageDraft(event.target.value);
                  messageSourceRef.current = 'text';
                }}
                placeholder="ミオに話しかける..."
                aria-label="メッセージ"
                data-testid="input-chat-message"
              />
              <button
                className={`voice-button${isListening ? ' listening' : ''}`}
                type="button"
                onClick={toggleSpeechRecognition}
                disabled={!supportsRecognition || !communicationPreferences.voice.inputEnabled}
                aria-label={isListening ? '音声入力を停止' : '音声入力を開始'}
                aria-pressed={isListening}
                title={!supportsRecognition ? 'このブラウザは音声入力に未対応です' : communicationPreferences.voice.inputEnabled ? 'マイクで音声入力' : '音声入力は設定でOFFです'}
                data-testid="button-toggle-microphone"
              >{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button>
              {isSpeaking && (
                <button
                  className="stop-speech-button"
                  type="button"
                  onClick={stopSpokenReply}
                  aria-label="読み上げを停止"
                  data-testid="button-stop-speech"
                ><Square size={14} fill="currentColor" /></button>
              )}
              <button className="send-button" type="submit" aria-label="メッセージを送信" disabled={!messageDraft.trim() || isWeatherLoading} data-testid="button-send-message"><Send size={16} /></button>
            </form>
            <p className={`speech-status${isListening ? ' active' : ''}`} role="status" aria-live="polite" data-testid="status-speech">
              {speechStatus || (isWeatherLoading ? 'ミオが天気を調べています…' : !communicationPreferences.voice.inputEnabled ? 'マイク入力はOFFです。音声設定から変更できます。' : supportsRecognition ? 'マイクを押して話せます。初回はブラウザの許可が必要です。' : '音声入力は未対応です。文字で入力できます。')}
            </p>
            <p className="chat-hint">
              {!communicationPreferences.voice.readRepliesAloud
                ? 'この会話はこの端末に保存されます。返答の読み上げはOFFです。'
                : supportsSynthesis
                  ? 'この会話はこの端末に保存されます。送信後、ミオが返答を読み上げます。'
                  : 'この会話はこの端末に保存されます。音声読み上げは未対応です。'}
            </p>
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

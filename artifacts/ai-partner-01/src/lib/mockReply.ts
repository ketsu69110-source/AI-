import type {
  ConversationEmotion,
} from './communication/types';
import type { ChatMessage, Task } from './types';

export type LocalAssistantReply = {
  text: string;
  emotion: ConversationEmotion;
};

function chooseFresh(
  message: string,
  options: LocalAssistantReply[],
  recentReplies: string[],
): LocalAssistantReply {
  const fresh = options.filter((option) => !recentReplies.includes(option.text));
  const pool = fresh.length > 0 ? fresh : options;
  const hash = Array.from(message).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
  return pool[hash % pool.length] ?? options[0] ?? { text: 'うん、聞いているよ。', emotion: 'warm' };
}

function shorten(text: string, maxLength = 24): string {
  const characters = Array.from(text.trim());
  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join('')}…`
    : characters.join('');
}

export function createLocalReply(
  message: string,
  history: ChatMessage[] = [],
  tasks: Task[] = [],
): LocalAssistantReply {
  const text = message.trim();
  const recentReplies = history
    .filter((item) => item.role === 'assistant')
    .slice(-5)
    .map((item) => item.text);

  if (/疲れ|つかれ|不安|心配|困っ|つら|怖い|できない|失敗/.test(text)) {
    return chooseFresh(text, [
      { text: 'それは大変だったね。今は急がなくて大丈夫だよ。少し休む？', emotion: 'concerned' },
      { text: '話してくれてありがとう。いちばん気になっていることから、一緒に見てみようか。', emotion: 'concerned' },
      { text: 'うん、心配になるよね。まずはできそうなことを一つだけ考えてみよう。', emotion: 'concerned' },
    ], recentReplies);
  }

  if (/うれし|嬉し|できた|やった|最高|楽しか/.test(text)) {
    return chooseFresh(text, [
      { text: 'わあ、よかったね。ミオまでうれしくなっちゃう。何がいちばんよかった？', emotion: 'happy' },
      { text: 'それはうれしいね。がんばったことが形になったんだね。', emotion: 'happy' },
      { text: 'やったね。今日はそのうれしさを、ゆっくり味わおう。', emotion: 'happy' },
    ], recentReplies);
  }

  if (/びっくり|驚|まさか|えっ/.test(text)) {
    return chooseFresh(text, [
      { text: 'えっ、それはびっくりだね。何があったの？', emotion: 'surprised' },
      { text: '思いがけないことだったんだね。もう少し聞かせて。', emotion: 'surprised' },
    ], recentReplies);
  }

  if (/ありがとう|助か/.test(text)) {
    return chooseFresh(text, [
      { text: 'どういたしまして。役に立ててよかった。', emotion: 'warm' },
      { text: 'ううん、いつでも声をかけてね。', emotion: 'warm' },
      { text: 'そう言ってもらえてうれしいな。ほかにも一緒に考えようか？', emotion: 'happy' },
    ], recentReplies);
  }

  if (/タスク|予定|宿題|やること|何から|残って/.test(text)) {
    const pending = tasks.filter((task) => !task.completed);
    if (pending.length === 0) {
      return chooseFresh(text, [
        { text: '今のタスクは全部終わっているよ。次にやりたいことがあれば教えてね。', emotion: 'happy' },
        { text: 'タスクは空っぽだよ。ひと息つく？それとも新しい予定を追加する？', emotion: 'warm' },
      ], recentReplies);
    }
    const firstTask = shorten(pending[0]?.title ?? '');
    return chooseFresh(text, [
      { text: `未完了は${pending.length}件だよ。「${firstTask}」から始める？`, emotion: 'explanatory' },
      { text: `${pending.length}件が残っているね。まず「${firstTask}」に取りかかるのはどうかな？`, emotion: 'warm' },
      { text: `タスクはあと${pending.length}件。最初の「${firstTask}」、今できそう？`, emotion: 'explanatory' },
    ], recentReplies);
  }

  const previousUser = [...history].reverse().find((item) => item.role === 'user');
  if (/^(それ|さっき|続き|そのこと|もう少し|やっぱり)/.test(text) && previousUser) {
    return {
      text: `さっきの「${shorten(previousUser.text, 18)}」の続きだね。どの部分をもう少し考えてみようか？`,
      emotion: 'explanatory',
    };
  }

  if (/[?？]|ですか|ますか|どう|なぜ|いつ|どこ|誰|どれ|かな/.test(text)) {
    return chooseFresh(text, [
      { text: 'いい質問だね。もう少し状況がわかると、ぴったり考えられそう。どんな場面のこと？', emotion: 'explanatory' },
      { text: 'そこが気になったんだね。もう少し詳しく聞かせてもらえる？', emotion: 'warm' },
      { text: '一緒に考えよう。いちばん知りたいところはどこかな？', emotion: 'explanatory' },
    ], recentReplies);
  }

  return chooseFresh(text, [
    { text: 'うん、聞いているよ。もう少し教えてくれる？', emotion: 'warm' },
    { text: 'なるほどね。今の話で、いちばん大事なのはどの部分？', emotion: 'explanatory' },
    { text: 'そうなんだ。ミオにも聞かせてくれてありがとう。', emotion: 'warm' },
    { text: 'いいね。次にどうしたいか、一緒に考えてみようか。', emotion: 'warm' },
  ], recentReplies);
}

const replies = [
  'うん、聞いています。次にできそうなことを一緒に考えましょう。',
  'いいですね。急がなくて大丈夫です。ひとつずつ進めていきましょう。',
  'なるほど。必要なら、その内容をタスクに追加しておきますね。',
  '話してくれてありがとう。今日のペースで大丈夫ですよ。',
];

export function createLocalReply(message: string): string {
  const text = message.trim();
  if (/疲れ|つかれ|休みたい/.test(text)) {
    return 'おつかれさまです。少し休憩してからでも大丈夫。無理のないペースでいきましょう。';
  }
  if (/ありがとう/.test(text)) {
    return 'どういたしまして。いつでも声をかけてくださいね。';
  }
  if (/タスク|予定|やること/.test(text)) {
    return '一緒に整理しましょう。下のタスク欄に、思いついたことを追加できます。';
  }
  return replies[text.length % replies.length];
}

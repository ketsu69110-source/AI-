import { Play, RefreshCw, X } from 'lucide-react';
import type { CommunicationPreferences } from '@/lib/communication/types';
import type { SpeechVoiceOption } from '@/lib/speech/synthesis';

type VoiceSettings = CommunicationPreferences['voice'];

type VoiceSettingsPanelProps = {
  settings: VoiceSettings;
  voices: SpeechVoiceOption[];
  supported: boolean;
  onChange: (patch: Partial<VoiceSettings>) => void;
  onPreview: () => void;
  onRefreshVoices: () => void;
  onClose: () => void;
};

export function VoiceSettingsPanel({
  settings,
  voices,
  supported,
  onChange,
  onPreview,
  onRefreshVoices,
  onClose,
}: VoiceSettingsPanelProps) {
  const savedVoiceUnavailable =
    settings.voiceURI !== '' &&
    !voices.some((voice) => voice.voiceURI === settings.voiceURI);

  return (
    <section id="voice-settings-panel" className="voice-settings-panel" aria-label="音声設定" data-testid="panel-voice-settings">
      <header className="voice-settings-heading">
        <div>
          <h3>ミオの声</h3>
          <p>端末で利用できる日本語音声から選べます。</p>
        </div>
        <button
          className="voice-settings-close"
          type="button"
          onClick={onClose}
          aria-label="音声設定を閉じる"
          data-testid="button-close-voice-settings"
        ><X size={16} /></button>
      </header>

      <div className="voice-settings-grid">
        <label className="voice-toggle-row">
          <input
            type="checkbox"
            checked={settings.inputEnabled}
            onChange={(event) => onChange({ inputEnabled: event.target.checked })}
            data-testid="toggle-voice-input"
          />
          <span>マイク入力を使う</span>
        </label>
        <label className="voice-toggle-row">
          <input
            type="checkbox"
            checked={settings.readRepliesAloud}
            onChange={(event) => onChange({ readRepliesAloud: event.target.checked })}
            data-testid="toggle-voice-replies"
          />
          <span>ミオの返答を読み上げる</span>
        </label>

        <label className="voice-setting-field voice-setting-wide">
          <span>日本語の声</span>
          <select
            value={savedVoiceUnavailable ? '' : settings.voiceURI}
            onChange={(event) => onChange({ voiceURI: event.target.value })}
            disabled={!supported}
            data-testid="select-japanese-voice"
          >
            <option value="">
              自動で選ぶ{voices[0] ? `（おすすめ：${voices[0].name}）` : ''}
            </option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} · {voice.localService ? '端末内' : 'ネットワーク'}
                {voice.default ? ' · 標準' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="voice-setting-field">
          <span>話す速さ <output>{settings.speechRate.toFixed(2)}×</output></span>
          <input
            type="range"
            min="0.75"
            max="1.25"
            step="0.05"
            value={settings.speechRate}
            onChange={(event) => onChange({ speechRate: Number(event.target.value) })}
            disabled={!supported}
            data-testid="range-speech-rate"
          />
        </label>
        <label className="voice-setting-field">
          <span>声の高さ <output>{settings.speechPitch.toFixed(2)}</output></span>
          <input
            type="range"
            min="0.8"
            max="1.2"
            step="0.05"
            value={settings.speechPitch}
            onChange={(event) => onChange({ speechPitch: Number(event.target.value) })}
            disabled={!supported}
            data-testid="range-speech-pitch"
          />
        </label>
      </div>

      {savedVoiceUnavailable && (
        <p className="voice-settings-note" role="status">
          前回選んだ音声はこの端末で見つかりません。自動の日本語音声に切り替えています。
        </p>
      )}
      {voices.length === 0 && (
        <p className="voice-settings-note" role="status" data-testid="status-japanese-voices">
          日本語音声を取得できません。Safariの音声一覧は端末の設定や読み込み状況で変わります。
        </p>
      )}

      <div className="voice-settings-actions">
        <button
          className="voice-refresh-button"
          type="button"
          onClick={onRefreshVoices}
          disabled={!supported}
          data-testid="button-refresh-voices"
        ><RefreshCw size={14} />音声を再読込</button>
        <button
          className="voice-preview-button"
          type="button"
          onClick={onPreview}
          disabled={!supported}
          data-testid="button-preview-voice"
        ><Play size={14} fill="currentColor" />声を試聴</button>
      </div>

      <p className="voice-settings-note">
        自然な抑揚は端末の音声エンジンに依存します。候補を試聴して選んでください。
      </p>
    </section>
  );
}

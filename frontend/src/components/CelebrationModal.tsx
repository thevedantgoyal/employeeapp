import { useState } from 'react';
import { api } from '@/integrations/api/client';
import type { CelebrationPerson } from '@/hooks/useCelebrations';

interface Props {
  celebrations: CelebrationPerson[];
  onClose: () => void;
  onWishSent: () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function CelebrationModal({ celebrations, onClose, onWishSent }: Props) {
  const [wishMessages, setWishMessages] = useState<Record<string, string>>({});
  const [wishedMap, setWishedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    celebrations.forEach((p) => {
      p.types.forEach((t) => {
        const key = `${p.userId}_${t.type}`;
        init[key] = t.type === 'birthday' ? p.alreadyWished.birthday : p.alreadyWished.anniversary;
      });
    });
    return init;
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(personId: string, celebType: 'birthday' | 'anniversary') {
    const key = `${personId}_${celebType}`;
    const message = wishMessages[key]?.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    try {
      const { error: reqError } = await api.post('/celebrations/wish', {
        targetUserId: personId,
        message,
        celebrationType: celebType,
      });
      if (reqError) throw new Error(reqError.message);
      setWishedMap((prev) => ({ ...prev, [key]: true }));
      onWishSent();
    } catch {
      setError('Failed to send wish. Please try again.');
      setSending(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes confetti-drop { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(800deg); opacity: 0; } }
        @keyframes modal-entrance { 0% { transform: scale(0.82) translateY(20px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        .cel-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; padding: 16px; overflow: hidden; backdrop-filter: blur(3px); }
        .cel-confetti { position: absolute; top: -16px; border-radius: 2px; pointer-events: none; animation: confetti-drop linear infinite; }
        .cel-modal { position: relative; z-index: 2; background: var(--color-background-primary, #fff); border-radius: 24px; width: 100%; max-width: 500px; max-height: 88vh; display: flex; flex-direction: column; animation: modal-entrance .4s cubic-bezier(.34,1.56,.64,1) forwards; box-shadow: 0 32px 80px rgba(0,0,0,.3); overflow: hidden; }
        .cel-header { padding: 28px 24px 20px; text-align: center; background: linear-gradient(135deg, #7c3aed11, #ec489911); border-bottom: 1px solid var(--color-border-tertiary, #eee); flex-shrink: 0; }
        .cel-header-title { font-size: 22px; font-weight: 600; margin: 0 0 4px; color: var(--color-text-primary, #111); }
        .cel-header-sub { font-size: 13px; color: var(--color-text-secondary, #666); margin: 0; }
        .cel-close { position: absolute; top: 14px; right: 14px; background: var(--color-background-secondary, #f5f5f5); border: 0; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; color: var(--color-text-secondary, #666); z-index: 3; }
        .cel-cards { overflow-y: auto; padding: 20px 20px 8px; flex: 1; }
        .cel-card { border: 1px solid var(--color-border-tertiary, #eee); border-radius: 16px; padding: 18px; margin-bottom: 14px; background: var(--color-background-secondary, #fafafa); }
        .cel-person-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .cel-avatar { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .cel-avatar-initials { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 17px; }
        .cel-name { font-size: 16px; font-weight: 600; margin: 0 0 2px; color: var(--color-text-primary, #111); }
        .cel-role { font-size: 13px; margin: 0; color: var(--color-text-secondary, #777); }
        .cel-badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
        .cel-badge-birthday { background: #fff0f6; color: #c2185b; border: 1px solid #f8bbd0; }
        .cel-badge-anniversary { background: #ede7f6; color: #512da8; border: 1px solid #d1c4e9; }
        .cel-textarea { width: 100%; box-sizing: border-box; border: 1.5px solid var(--color-border-secondary, #ddd); border-radius: 10px; padding: 10px 12px; font-size: 14px; resize: vertical; min-height: 74px; font-family: inherit; line-height: 1.5; background: var(--color-background-primary, #fff); color: var(--color-text-primary, #111); }
        .cel-textarea:disabled { opacity: .45; cursor: not-allowed; }
        .cel-send-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; gap: 10px; }
        .cel-send-btn { padding: 9px 22px; border-radius: 10px; border: 0; font-size: 14px; font-weight: 600; white-space: nowrap; }
        .cel-send-btn-active { background: #7c3aed; color: #fff; cursor: pointer; }
        .cel-send-btn-done { background: #d1fae5; color: #065f46; cursor: default; }
        .cel-send-btn:disabled { opacity: .5; cursor: not-allowed; }
        .cel-char-hint { font-size: 12px; color: var(--color-text-tertiary, #aaa); }
        .cel-error { font-size: 13px; color: #dc2626; text-align: center; padding: 8px 0 4px; }
        .cel-footer { padding: 12px 20px 20px; text-align: center; flex-shrink: 0; }
        .cel-footer-btn { background: none; border: 1.5px solid var(--color-border-secondary, #ddd); border-radius: 10px; padding: 8px 28px; font-size: 14px; cursor: pointer; color: var(--color-text-secondary, #666); }
      `}</style>

      <div className="cel-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {Array.from({ length: 24 }).map((_, i) => {
          const palette = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8', '#20c997', '#f06595'];
          return (
            <div
              key={i}
              className="cel-confetti"
              style={{
                left: `${(i * 4.3 + 1.5) % 100}%`,
                width: `${6 + (i % 3) * 3}px`,
                height: `${6 + (i % 3) * 3}px`,
                background: palette[i % palette.length],
                borderRadius: i % 5 === 0 ? '50%' : '2px',
                animationDuration: `${2.4 + (i % 5) * 0.45}s`,
                animationDelay: `${(i * 0.31) % 2.8}s`,
              }}
            />
          );
        })}

        <div className="cel-modal">
          <button className="cel-close" onClick={onClose}>✕</button>
          <div className="cel-header">
            <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10 }}>🎊</div>
            <p className="cel-header-title">Celebrations Today!</p>
            <p className="cel-header-sub">
              {celebrations.length === 1 ? `${celebrations[0].fullName} is celebrating today` : `${celebrations.length} people are celebrating today`}
            </p>
          </div>

          <div className="cel-cards">
            {error && <p className="cel-error">{error}</p>}
            {celebrations.map((person) => {
              const avatarBg = AVATAR_COLORS[person.fullName.charCodeAt(0) % AVATAR_COLORS.length];
              return (
                <div key={person.userId} className="cel-card">
                  <div className="cel-person-row">
                    {person.avatarUrl ? (
                      <img src={person.avatarUrl} alt={person.fullName} className="cel-avatar" />
                    ) : (
                      <div className="cel-avatar-initials" style={{ background: avatarBg }}>{getInitials(person.fullName)}</div>
                    )}
                    <div>
                      <p className="cel-name">{person.fullName}</p>
                      <p className="cel-role">{[person.jobTitle, person.department].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>

                  {person.types.map((ct) => {
                    const key = `${person.userId}_${ct.type}`;
                    const wished = wishedMap[key] ?? false;
                    const msgVal = wishMessages[key] ?? '';
                    return (
                      <div key={key}>
                        <span className={`cel-badge ${ct.type === 'birthday' ? 'cel-badge-birthday' : 'cel-badge-anniversary'}`}>
                          {ct.emoji} {ct.label}
                        </span>
                        <textarea
                          className="cel-textarea"
                          placeholder={`Write a wish for ${person.fullName}...`}
                          value={wished ? '' : msgVal}
                          disabled={wished || sending}
                          maxLength={300}
                          onChange={(e) => setWishMessages((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                        <div className="cel-send-row">
                          <span className="cel-char-hint">{wished ? '' : `${msgVal.length}/300`}</span>
                          <button
                            className={`cel-send-btn ${wished ? 'cel-send-btn-done' : 'cel-send-btn-active'}`}
                            disabled={wished || sending || !msgVal.trim()}
                            onClick={() => handleSend(person.userId, ct.type)}
                          >
                            {wished ? 'Wished ✓' : sending ? 'Sending...' : `Send Wish ${ct.emoji}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="cel-footer">
            <button className="cel-footer-btn" onClick={onClose}>Maybe later</button>
          </div>
        </div>
      </div>
    </>
  );
}

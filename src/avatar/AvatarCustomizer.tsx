/**
 * 아바타 외형 커스터마이징 패널.
 *
 * - RPM Creator 새 탭 링크: 사용자가 얼굴/성별/머리카락을 고른 뒤 URL을 복사해오게 함
 * - URL 입력칸: 복사해온 RPM GLB URL 적용 (morphTargets 쿼리 자동 보강)
 * - 파일 업로드: 오프라인 .glb 파일을 블롭 URL로 로드
 * - 토글: 헤어/액세서리 메시 숨기기, 목·어깨 노출
 * - 초기화: 기본 샘플 GLB로 복구
 */

import { useRef, useState, type ChangeEvent } from 'react';
import { avatarConfig, useAvatarConfig } from './avatarConfig.js';

// RPM URL에 립싱크에 필요한 morph target 쿼리가 빠져 있으면 자동 보강.
// 이게 없으면 Oculus Visemes / ARKit 블렌드셰이프가 GLB에 포함되지 않는다.
function ensureMorphQuery(url: string): string {
  if (!/^https?:\/\//.test(url)) return url; // 로컬 경로/blob은 그대로
  try {
    const u = new URL(url);
    if (!/readyplayer\.me/.test(u.hostname)) return url;
    const existing = u.searchParams.get('morphTargets') ?? '';
    if (!existing.includes('ARKit') || !existing.includes('Oculus')) {
      u.searchParams.set('morphTargets', 'ARKit,Oculus Visemes');
    }
    if (!u.searchParams.has('textureAtlas')) {
      u.searchParams.set('textureAtlas', '1024');
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function AvatarCustomizer() {
  const cfg = useAvatarConfig();
  const [urlDraft, setUrlDraft] = useState<string>(
    cfg.url.startsWith('blob:') ? '' : cfg.url,
  );
  const [msg, setMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function flashMsg(text: string, ms = 2000) {
    setMsg(text);
    window.setTimeout(() => setMsg(''), ms);
  }

  function applyUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      flashMsg('URL을 입력하세요');
      return;
    }
    const finalUrl = ensureMorphQuery(trimmed);
    avatarConfig.setUrl(finalUrl);
    setUrlDraft(finalUrl);
    flashMsg('URL 적용됨');
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      flashMsg('.glb 또는 .gltf 파일만 지원합니다');
      return;
    }
    const url = URL.createObjectURL(file);
    avatarConfig.setUrl(url);
    setUrlDraft('');
    flashMsg(`로컬 파일 로드: ${file.name}`);
    // 동일 파일 재선택도 change 이벤트가 뜨도록 초기화
    e.target.value = '';
  }

  function resetDefault() {
    avatarConfig.resetToDefault();
    setUrlDraft(avatarConfig.getDefaultUrl());
    flashMsg('기본 샘플로 초기화됨');
  }

  return (
    <div style={styles.root}>
      <div style={styles.sectionHeader}>
        외모 커스터마이징
        {msg && <span style={styles.flash}>{msg}</span>}
      </div>

      <div style={styles.rowStack}>
        <label style={styles.label}>RPM 아바타 URL</label>
        <div style={styles.inputRow}>
          <input
            type="text"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://models.readyplayer.me/xxxxx.glb"
            style={styles.input}
            spellCheck={false}
          />
          <button onClick={applyUrl} style={{ ...styles.smallBtn, ...styles.smallBtnPrimary }}>
            적용
          </button>
        </div>
        <a
          href="https://readyplayer.me/avatar"
          target="_blank"
          rel="noreferrer noopener"
          style={styles.link}
        >
          새 아바타 만들기 (readyplayer.me) ↗
        </a>
      </div>

      <div style={styles.rowStack}>
        <label style={styles.label}>GLB 파일 업로드</label>
        <div style={styles.inputRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
            onChange={onFile}
            style={styles.fileInput}
          />
        </div>
      </div>

      <div style={styles.rowStack}>
        <label style={styles.label}>성별 (음성 매칭용)</label>
        <div style={styles.genderRow}>
          {(['male', 'female'] as const).map((g) => (
            <button
              key={g}
              onClick={() => avatarConfig.setGender(g)}
              style={{
                ...styles.genderBtn,
                ...(cfg.gender === g ? styles.genderBtnActive : null),
              }}
            >
              {g === 'male' ? '남성' : '여성'}
            </button>
          ))}
        </div>
        <div style={styles.hint}>
          선택한 성별에 맞는 한국어 TTS 음성이 있으면 자동 선택됩니다.
        </div>
      </div>

      <div style={styles.checkRow}>
        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={cfg.hideExtras}
            onChange={(e) => avatarConfig.setHideExtras(e.target.checked)}
          />
          <span>헤어·액세서리 숨기기 (Wolf3D_Avatar_Transparent 메시)</span>
        </label>
        <div style={styles.hint}>
          visage 샘플은 헬멧이 이 메시에 있어 켜두는 게 맞고, 정식 RPM 아바타에서는
          머리카락·속눈썹이 이 메시라 꺼야 합니다.
        </div>
      </div>

      <div style={styles.checkRow}>
        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={cfg.showNeck}
            onChange={(e) => avatarConfig.setShowNeck(e.target.checked)}
          />
          <span>목·어깨까지 보이기 (클리핑 해제)</span>
        </label>
      </div>

      <div style={styles.buttons}>
        <button onClick={resetDefault} style={styles.smallBtn}>
          기본 샘플로 초기화
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    background: '#0b1220',
    border: '1px solid #1f2a3d',
    borderRadius: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 700,
    color: '#a5b4fc',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flash: {
    fontSize: 11,
    color: '#86efac',
    fontWeight: 500,
  },
  rowStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
  },
  inputRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  fileInput: {
    fontSize: 12,
    color: '#94a3b8',
  },
  link: {
    fontSize: 11,
    color: '#60a5fa',
    textDecoration: 'none',
  },
  checkRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  checkLabel: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    fontSize: 12,
    color: '#cbd5e1',
    cursor: 'pointer',
  },
  hint: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 22,
    lineHeight: 1.4,
  },
  buttons: {
    display: 'flex',
    gap: 6,
  },
  smallBtn: {
    padding: '6px 12px',
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#cbd5e1',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  smallBtnPrimary: {
    background: '#3b82f6',
    border: '1px solid #3b82f6',
    color: 'white',
  },
  genderRow: {
    display: 'flex',
    gap: 6,
  },
  genderBtn: {
    flex: 1,
    padding: '6px 12px',
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#cbd5e1',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
  },
  genderBtnActive: {
    background: '#3b82f6',
    border: '1px solid #3b82f6',
    color: 'white',
  },
};

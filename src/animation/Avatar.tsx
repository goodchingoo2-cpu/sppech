/**
 * 3D 튜터 아바타 렌더 컴포넌트.
 *
 * - Ready Player Me GLB를 useGLTF로 로드
 * - SkinnedMesh들의 morphTarget을 수집해 MorphController에 연결
 * - VisemePlayer + GazeController를 useFrame로 구동
 * - avatarBus 이벤트를 구독해 재생/표정 변경 반영
 * - GLB 로드 실패 시 플레이스홀더로 Fallback
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Center, OrbitControls } from '@react-three/drei';
import { Suspense, Component, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';

import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { MorphController, type MorphTargetAdapter } from './MorphController.js';
import { VisemePlayer } from './VisemePlayer.js';
import { GazeController } from './GazeController.js';
import {
  EXPRESSION_PRESETS,
  EXPRESSION_BLENDSHAPE_NAMES,
  type ExpressionName,
} from './ExpressionPreset.js';
import { avatarBus } from './avatarBus.js';
import type { VisemeFrame } from '../viseme/timeline.js';
import { avatarConfig, useAvatarConfig } from '../avatar/avatarConfig.js';

type MeshWithMorph = THREE.Mesh & {
  morphTargetDictionary: Record<string, number>;
  morphTargetInfluences: number[];
};

function hasMorph(obj: THREE.Object3D): obj is MeshWithMorph {
  const m = obj as THREE.Mesh;
  return (
    m.isMesh === true &&
    !!(m as THREE.Mesh).morphTargetDictionary &&
    !!(m as THREE.Mesh).morphTargetInfluences
  );
}

function collectAdapters(root: THREE.Object3D): MorphTargetAdapter[] {
  const adapters: MorphTargetAdapter[] = [];
  root.traverse((obj) => {
    if (!hasMorph(obj)) return;
    const dict = obj.morphTargetDictionary;
    const influences = obj.morphTargetInfluences;
    const names = Object.keys(dict);
    adapters.push({
      names,
      get(name: string) {
        const i = dict[name];
        return i === undefined ? 0 : influences[i] ?? 0;
      },
      set(name: string, value: number) {
        const i = dict[name];
        if (i !== undefined) influences[i] = value;
      },
    });
  });
  return adapters;
}

function AvatarModel({ url, hideExtras }: { url: string; hideExtras: boolean }) {
  const gltf = useGLTF(url);
  // SkinnedMesh가 포함된 GLB는 반드시 SkeletonUtils.clone을 써야 본 바인딩이
  // 유지된다. Object3D.clone(true)는 skeleton을 복제하지 않아 렌더가 깨진다.
  const scene = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);

  const controllerRef = useRef<MorphController | null>(null);
  const playerRef = useRef<VisemePlayer | null>(null);
  const gazeRef = useRef<GazeController | null>(null);
  const lastTickRef = useRef(0);

  // 헤어/액세서리 메시 가시성은 hideExtras 토글을 따른다.
  // visage 샘플: 이 메시가 헬멧 → true 유지
  // 정식 RPM 아바타: 이 메시가 머리카락/속눈썹 → false 권장
  useEffect(() => {
    const EXTRA_MESH_NAMES = new Set(['Wolf3D_Avatar_Transparent']);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && EXTRA_MESH_NAMES.has(m.name)) {
        m.visible = !hideExtras;
      }
    });
  }, [scene, hideExtras]);

  useEffect(() => {
    const adapters = collectAdapters(scene);
    if (adapters.length === 0) {
      console.warn('[Avatar] no morph targets found in GLB. Check morphTargets query param.');
    }
    const ctrl = new MorphController(adapters, { smoothing: 0.28 });
    ctrl.registerManagedNames(EXPRESSION_BLENDSHAPE_NAMES);
    ctrl.setLayer('expression', EXPRESSION_PRESETS.smile);

    const player = new VisemePlayer(ctrl, { crossfadeMs: 45 });
    const gaze = new GazeController(ctrl);

    controllerRef.current = ctrl;
    playerRef.current = player;
    gazeRef.current = gaze;
    lastTickRef.current = performance.now();

    const unsub = avatarBus.subscribe({
      onPlay: (frames: readonly VisemeFrame[]) => {
        player.play(frames, performance.now());
      },
      onStop: () => player.stop(),
      onSetExpression: (name: ExpressionName) => {
        ctrl.setLayer('expression', EXPRESSION_PRESETS[name]);
      },
    });

    return () => {
      unsub();
      ctrl.reset();
    };
  }, [scene]);

  useFrame(() => {
    const now = performance.now();
    const dt = Math.min(50, now - lastTickRef.current);
    lastTickRef.current = now;
    gazeRef.current?.tick(now);
    playerRef.current?.tick(now, dt);
  });

  // half-body GLB는 상반신만이라 피벗 위치가 모델마다 다름 → <Center>가 자동 정렬.
  return <primitive object={scene} />;
}

function PlaceholderAvatar() {
  // GLB 실패 시 표시되는 단순 3D 플레이스홀더.
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.35, 48, 48]} />
        <meshStandardMaterial color="#e6c9a8" roughness={0.7} />
      </mesh>
      <mesh position={[-0.12, 0.18, 0.3]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#2b2b2b" />
      </mesh>
      <mesh position={[0.12, 0.18, 0.3]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#2b2b2b" />
      </mesh>
      <mesh position={[0, -0.05, 0.32]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.12, 0.025, 0.02]} />
        <meshStandardMaterial color="#a83d4c" />
      </mesh>
    </group>
  );
}

/** GLB 로드 실패 시 Canvas 위에 덮이는 2D 안내 오버레이.
 *  "뭐가 안 뜨는지"를 명확히 알려주고 한 번의 클릭으로 기본 아바타로 복구할 수 있게 한다. */
function LoadErrorOverlay({ url, onReset }: { url: string; onReset: () => void }) {
  const short = url.length > 60 ? `${url.slice(0, 57)}...` : url;
  return (
    <div style={overlayStyles.wrap}>
      <div style={overlayStyles.card}>
        <div style={overlayStyles.title}>3D 아바타 로드 실패</div>
        <div style={overlayStyles.desc}>
          GLB 파일을 불러오지 못해 임시 플레이스홀더가 표시되고 있어요.
        </div>
        <div style={overlayStyles.url}>URL: <code>{short}</code></div>
        <div style={overlayStyles.hint}>
          · 파일이 존재하는지 확인 (<code>assets/models/tutor.glb</code>)<br />
          · Vite dev 서버가 실행 중인지 확인<br />
          · 또는 아래 버튼으로 기본 아바타로 복구
        </div>
        <button onClick={onReset} style={overlayStyles.btn}>
          기본 아바타로 리셋
        </button>
      </div>
    </div>
  );
}

const overlayStyles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    padding: 16,
  },
  card: {
    pointerEvents: 'auto',
    background: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    borderRadius: 12,
    padding: '14px 18px',
    color: '#fecaca',
    fontSize: 13,
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fca5a5',
  },
  desc: {
    color: '#fecaca',
    lineHeight: 1.5,
  },
  url: {
    fontSize: 11,
    color: '#94a3b8',
    wordBreak: 'break-all',
    background: '#0b1220',
    padding: '6px 8px',
    borderRadius: 6,
  },
  hint: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 1.6,
  },
  btn: {
    alignSelf: 'flex-start',
    padding: '6px 14px',
    background: '#3b82f6',
    border: '1px solid #3b82f6',
    color: 'white',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

/** GLB 로드 실패를 포착해 플레이스홀더로 대체 + 외부에 상태 알림. */
class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onErrorChange?: (err: boolean) => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) {
    console.warn('[Avatar] GLB load failed, using placeholder:', err);
    this.props.onErrorChange?.(true);
  }
  componentDidUpdate(prev: Readonly<{ children: ReactNode; fallback: ReactNode }>) {
    // key가 바뀌면 React가 통째로 remount 하므로 여긴 실질적으로 도달하지 않음.
    // 다만 onErrorChange 콜백이 바뀌었을 때 대비해서 noop.
    void prev;
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * 목선 아래의 지오메트리(어깨/팔/가슴)를 월드 Y = `y` 평면으로 잘라내
 * 머리만 남기는 글로벌 클리핑. RPM half-body는 T-pose라 팔이 수평으로
 * 뻗어있어서 이 평면 하나만으로 손까지 깨끗하게 제거된다.
 */
function HeadOnlyClip({ enabled, y = -0.02 }: { enabled: boolean; y?: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!enabled) {
      const prev = gl.clippingPlanes;
      gl.clippingPlanes = [];
      return () => {
        gl.clippingPlanes = prev;
      };
    }
    // normal=(0,1,0), constant=-y  → y_point >= y 만 유지 (위쪽만 남김)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const prev = gl.clippingPlanes;
    gl.clippingPlanes = [plane];
    return () => {
      gl.clippingPlanes = prev;
    };
  }, [gl, y, enabled]);
  return null;
}

function Scene({ onErrorChange }: { onErrorChange: (err: boolean) => void }) {
  const cfg = useAvatarConfig();
  // showNeck=true면 클리핑 해제, 카메라도 살짝 물러서며 타겟을 중립 Y로 옮긴다.
  const targetY = cfg.showNeck ? 0.0 : 0.115;
  return (
    <>
      <HeadOnlyClip enabled={!cfg.showNeck} y={-0.02} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 3, 2]} intensity={1.15} />
      <directionalLight position={[-2, 1, 1]} intensity={0.45} color="#a8c8ff" />
      {/* rim light - 얼굴 윤곽을 배경에서 살짝 떼어낸다 */}
      <directionalLight position={[0, 1.5, -2]} intensity={0.6} color="#ffd8a8" />
      <Environment preset="studio" />
      <ModelErrorBoundary
        key={cfg.url}
        fallback={<PlaceholderAvatar />}
        onErrorChange={onErrorChange}
      >
        <Suspense fallback={<PlaceholderAvatar />}>
          {/* Center: 모델 피벗을 원점에 정렬.
              key={cfg.url}로 URL 변경 시 완전 재마운트 (clone된 scene + 컨트롤러 리셋). */}
          <Center key={cfg.url}>
            <AvatarModel url={cfg.url} hideExtras={cfg.hideExtras} />
          </Center>
        </Suspense>
      </ModelErrorBoundary>
      {/* 클리핑 후 보이는 영역(목선 y=-0.02 ~ 정수리 y=0.25)의 중심 y≈0.115에
          카메라 타겟을 맞춰 얼굴이 화면 정중앙에 오도록 한다. */}
      <OrbitControls
        target={[0, targetY, 0]}
        enablePan={true}
        minDistance={0.25}
        maxDistance={3.0}
      />
    </>
  );
}

export function AvatarStage() {
  const cfg = useAvatarConfig();
  const [loadError, setLoadError] = useState(false);

  // URL이 바뀔 때 에러 상태 초기화 (리셋 버튼 눌렀을 때 오버레이가 즉시 사라지도록).
  useEffect(() => {
    setLoadError(false);
  }, [cfg.url]);

  function onReset() {
    avatarConfig.resetToDefault();
    // 강제 재평가 — useEffect가 url 변경을 잡아 loadError=false로.
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0.115, 0.7], fov: 26 }}
        style={{
          width: '100%',
          height: '100%',
          // 캐릭터 뒤쪽에서 빛이 퍼지는 듯한 스포트라이트 배경.
          // 중앙은 따뜻한 아이보리 → 외곽은 차가운 네이비로 떨어지면서
          // 피부 톤(웜)이 배경(쿨)과 자연스럽게 대비된다.
          background:
            'radial-gradient(ellipse 70% 55% at 50% 42%, ' +
            '#e8dcc4 0%, #a69c8f 35%, #3b4a5c 75%, #1a2332 100%)',
        }}
        dpr={[1, 2]}
      >
        <Scene onErrorChange={setLoadError} />
      </Canvas>
      {loadError && <LoadErrorOverlay url={cfg.url} onReset={onReset} />}
    </div>
  );
}

// drei의 useGLTF.preload로 초기 URL 캐시 워밍업
useGLTF.preload(avatarConfig.get().url);

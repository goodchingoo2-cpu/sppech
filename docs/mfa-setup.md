# MFA(Montreal Forced Aligner) 설치 및 사용 가이드

MFA는 음성 파일과 한글 대본을 입력하면 각 음소의 시작/끝 시간을 자동으로 정렬해주는
무료 오픈소스 도구입니다.

---

## 1. 사전 요구사항

- **Conda** (Miniconda 또는 Anaconda)
  설치: https://docs.conda.io/en/latest/miniconda.html

---

## 2. MFA 설치

```bash
# 전용 conda 환경 생성
conda create -n aligner -c conda-forge montreal-forced-aligner python=3.10
conda activate aligner

# 설치 확인
mfa version
```

---

## 3. 한국어 모델 다운로드

```bash
# 한국어 음향 모델 (acoustic model)
mfa model download acoustic korean_mfa

# 한국어 발음 사전 (pronunciation dictionary)
mfa model download dictionary korean_mfa
```

다운로드된 모델은 `~/Documents/MFA/pretrained_models/` 에 저장됩니다.

---

## 4. 입력 파일 준비

### 디렉토리 구조
```
audio_input/
├── sample01.wav      # 한국어 음성 파일 (16kHz, 모노 권장)
├── sample01.txt      # 동일 이름의 한글 대본
├── sample02.wav
└── sample02.txt
```

### 대본 파일 규칙 (`.txt`)
- 음성에 해당하는 한글만 작성
- 숫자는 한글로 변환 필요: `100` → `백`, `2024년` → `이천이십사년`
- 외래어는 한글 표기로 변환: `coffee` → `커피`

예시 (`sample01.txt`):
```
아버지가 방에 들어가신다
```

---

## 5. 정렬 실행

```bash
# 기본 실행
mfa align audio_input/ korean_mfa korean_mfa output_dir/

# 옵션 설명
# audio_input/  : 입력 디렉토리 (wav + txt 쌍)
# korean_mfa    : 발음 사전
# korean_mfa    : 음향 모델
# output_dir/   : TextGrid 출력 디렉토리
```

---

## 6. 출력 형식 (TextGrid)

MFA는 Praat의 `.TextGrid` 형식으로 결과를 출력합니다.

```
sample01.TextGrid 내용 예시:
  Word tier:   아버지  [0.0 ~ 0.85]
  Phone tier:  ㅇ/ㅏ   [0.0  ~ 0.25]
               ㅂ/ㅓ   [0.25 ~ 0.55]
               ㅈ/ㅣ   [0.55 ~ 0.85]
```

---

## 7. TextGrid → JSON 변환

이 시스템은 JSON 형식을 사용합니다. 아래 Python 스크립트로 변환하세요.

```python
# textgrid_to_json.py
# 실행: python textgrid_to_json.py sample01.TextGrid sample01.json

import sys
import json

def parse_textgrid(path: str) -> dict:
    """단순 TextGrid 파서 (tiers: words, phones)"""
    with open(path, encoding='utf-8') as f:
        content = f.read()

    # 실제 프로젝트에서는 tgt, textgrid 등 라이브러리 사용 권장
    # pip install tgt
    import tgt
    tg = tgt.read_textgrid(path)

    result = {"words": [], "phones": []}

    word_tier = tg.get_tier_by_name("words")
    phone_tier = tg.get_tier_by_name("phones")

    for interval in word_tier:
        if interval.text.strip():
            result["words"].append({
                "word": interval.text,
                "start": interval.start_time,
                "end": interval.end_time
            })

    for interval in phone_tier:
        result["phones"].append({
            "label": interval.text,
            "start": interval.start_time,
            "end": interval.end_time
        })

    return result


if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    data = parse_textgrid(input_path)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"변환 완료: {output_path}")
```

변환 실행:
```bash
pip install tgt
python textgrid_to_json.py output_dir/sample01.TextGrid sample01.json
```

---

## 8. 변환된 JSON 형식

```json
{
  "words": [
    { "word": "아버지", "start": 0.0, "end": 0.85 }
  ],
  "phones": [
    { "label": "ㅇ", "start": 0.0,  "end": 0.12 },
    { "label": "ㅏ", "start": 0.12, "end": 0.25 },
    { "label": "ㅂ", "start": 0.25, "end": 0.40 },
    { "label": "ㅓ", "start": 0.40, "end": 0.55 },
    { "label": "ㅈ", "start": 0.55, "end": 0.68 },
    { "label": "ㅣ", "start": 0.68, "end": 0.85 }
  ]
}
```

> MFA의 실제 phone label 포맷은 모델에 따라 다를 수 있습니다.
> `mfaParser.ts`의 `MFA_LABEL_TO_JAMO` 매핑 테이블을 실제 출력에 맞게 수정하세요.

---

## 9. 이 시스템에서 사용

```bash
# JSON 변환 후 애니메이션 생성
npx tsx src/cli.ts --audio sample01.wav --mfa sample01.json --output animation.mp4
```

---

## 문제 해결

| 증상 | 해결 방법 |
|---|---|
| `mfa: command not found` | `conda activate aligner` 실행 후 재시도 |
| 정렬 오류 (텍스트 불일치) | txt 파일의 숫자/외래어를 한글로 변환 |
| 음질 문제 | WAV를 16kHz, 모노로 변환: `ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav` |

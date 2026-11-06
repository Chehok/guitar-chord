# Ponytail(Cursor 훅) — 이 저장소 최소 통합

[Cursor Hooks](https://cursor.com/docs/hooks)와 [Ponytail Cursor 훅 문서](https://github.com/DietrichGebert/ponytail/blob/main/docs/cursor-hooks.md)를 기준으로, 클라우드 에이전트에서 **프로젝트 루트의** `.cursor/hooks.json`만으로 Ponytail을 **선택적으로** 켤 수 있게 했습니다.

## 출처(벤더)

- **업스트림**: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) 태그 **v5.3.3**, Git 커밋 `7801d061243d7b753bad0e0b3c057cd250b11755`
- **사본 위치**: `vendor/ponytail/` (원본 `LICENSE` 포함)
- **이 PR에서 추가한 프로젝트 전용 파일**: `.cursor/hooks.json`, `docs/ponytail-cursor-cloud.md`, `scripts/smoke-ponytail-hook.cjs`

공식 구현 파일은 수정하지 않았습니다.

## 이 저장소에서의 동작(기본)

- **`.cursor/hooks.json`에는 `beforeSubmitPrompt`만** 등록했습니다. 일반 문장으로 질문할 때는 훅이 **추가 컨텍스트를 내보내지 않는** 것이 정상입니다(표준 입력만 처리하고 stdout이 비거나 아무것도 추가하지 않음).
- **옵트인**: 채팅에 `/ponytail lite`, `/ponytail full`, `/ponytail ultra`처럼 보내면, 해당 턴에서 규칙 요약이 붙습니다. 끄려면 Ponytail 문서대로 `stop ponytail` 또는 `normal mode`(단독 줄) 또는 `/ponytail off`를 사용합니다.
- **공식 문서와 Ponytail 쪽 설명**: 클라우드 에이전트에서는 **`sessionStart`가 세션 시작 시점에 맞지 않아 실행되지 않거나 사실상 의미가 없을 수 있음**(지연·미지원). 이 저장소는 **시작 주입을 피하고** `beforeSubmitPrompt`만 두어, “항상 켜짐”에 가깝게 쓰이지 않도록 했습니다.
- **로컬 맥 Cursor**에서 사용자 홈의 `~/.cursor/hooks.json`에 이미 Ponytail을 깔아 두었다면, Cursor는 프로젝트 훅과 병합·적용 규칙을 따릅니다. 이 저장소는 **기존 비 Ponytail 훅을 덮어쓰지 않도록** 공식 `scripts/cursor-hooks.js install --project` 병합 방식을 문서화만 하고, 다른 훅이 없어 **직접 `hooks.json`을 최소 구성**했습니다.

## 클라우드에서의 “실서비스 주입” 검증 한계

이 문서를 쓰는 시점에, **실제 Cursor Cloud Agent 런이 Hooks 출력 채널·모델 컨텍스트까지 포함해 “주입이 일어났다”는 것을 이 에이전트 실행만으로 증명하지는 못했습니다.** 아래 스모크는 **동일 바이너리를 수동으로 stdin에 JSON을 넣어 실행**한 결과입니다(로컬/VM에서 재현 가능).

## 수동 스모크

저장소 루트에서:

```sh
node scripts/smoke-ponytail-hook.cjs
```

`CURSOR_VERSION`을 설정해 Cursor 분기를 타도록 한 뒤, (1) 일반 프롬프트, (2) `/ponytail lite` 프롬프트에 대한 stdout 길이를 출력합니다.

이 브랜치에서 한 번 실행한 예(로컬 VM, **실제 클라우드 훅 실행 아님**):

- 일반 프롬프트: stdout **0바이트**, `additional_context` **0자**
- `/ponytail lite` 옵트인: stdout **3046바이트**, `additional_context` **2951자**, JSON 키 `additional_context`, `continue`

## 제거 방법

1. `.cursor/hooks.json`에서 `beforeSubmitPrompt`의 Ponytail 항목을 삭제하거나 파일을 제거합니다.
2. 선택: `vendor/ponytail/` 디렉터리와 이 문서를 삭제합니다.

## 재설치·경로 갱신(공식 스크립트)

체크아웃 경로가 바뀌면 공식 설치 스크립트로 프로젝트 스코프 병합을 다시 할 수 있습니다.

```sh
node vendor/ponytail/scripts/cursor-hooks.js install --project
```

현재 이 저장소는 **최소 구성**을 위해 위 스크립트 출력과 동일한 항목을 수동으로 `.cursor/hooks.json`에 넣었습니다.

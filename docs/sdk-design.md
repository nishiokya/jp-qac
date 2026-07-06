# jp-qac SDK 設計書

対象: `public/sdk/jp-qac.js` / `public/sdk/jp-qac.css`（v0.1.0）

## 1. 目的とビジネスモデル

jp-qac 本体（API・SDK）は **無料** で提供し、収益は **有償サポート**
（導入支援・優先対応・運用支援）から得る。この前提が SDK 設計を規定する:

- **導入障壁を最小化する。** `<script>` タグ 1 本 + 数行で動くこと。
  無料ユーザーが増えるほどサポート契約の母数が増える。
- **セルフホストが第一級。** 課金ゲートやライセンスキーを SDK に入れない。
  API キー（NTA アプリケーション ID）はサーバー側にのみ存在し、
  ブラウザには一切露出しない。
- **サポートで差がつく部分**（CSP 対応、SPA 統合、独自テーマ、大量トラフィック時の
  チューニング）は SDK 側にフックだけ用意し、ドキュメント化はサポート契約側の価値とする。

## 2. 設計原則

| 原則 | 具体策 |
|---|---|
| 依存ゼロ | fetch / AbortController / CustomEvent のみ使用。ビルド不要の単一 IIFE |
| 軽量 | JS + CSS 合計 10KB 未満（未圧縮）を維持する |
| 非破壊 | 利用側の DOM 構造を変更しない。候補リストは `document.body` 直下に追加 |
| フレームワーク共存 | 値の書き込み後に `input` / `change` イベントを発火し、React/Vue のバインディングが追従できるようにする |
| アクセシブル | WAI-ARIA combobox パターン（`role`, `aria-expanded`, `aria-activedescendant`）と完全なキーボード操作 |
| テーマは CSS 変数 | `--jpqac-*` カスタムプロパティのみで見た目を上書き可能。JS にスタイル値を持たない |

## 3. 公開 API

グローバル `JpQac`（将来は ESM の named export と同一シグネチャにする）。

### 3.1 `JpQac.configure(options)`

| オプション | 型 | 既定値 | 説明 |
|---|---|---|---|
| `baseUrl` | string | `""`（同一オリジン） | API サーバーのオリジン。末尾スラッシュは自動除去 |

### 3.2 `JpQac.postal(target, options)` — 郵便番号 → 住所自動入力

7 桁そろった時点で自動検索する。全角数字・ハイフン（`１００－０００１`）は
クライアント側でも正規化する（サーバーも受理するため二重防御）。

| オプション | 型 | 既定値 | 説明 |
|---|---|---|---|
| `fill` | object | — | `Address` のフィールド名 → セレクタ/要素 のマップ。例 `{ prefecture: "#pref", city: "#city", town: "#town" }`。カナ（`prefectureKana` 等）も指定可 |
| `onResult` | `(addresses, meta) => void` | — | 複数町域ヒット時の選択 UI など、独自処理用。404 時は空配列で呼ぶ |
| `onError` | `(error) => void` | — | 通信・サーバーエラー |
| `debounce` | number | 150 | ミリ秒 |

戻り値: `{ destroy() }` — リスナーと進行中リクエストを破棄（SPA のアンマウント用）。

### 3.3 `JpQac.corporate(target, options)` — 法人名オートコンプリート

| オプション | 型 | 既定値 | 説明 |
|---|---|---|---|
| `fill` | object | — | `Corporation` のフィールド名 → セレクタ/要素。例 `{ corporateNumber: "#num", postalCode: "#zip" }` |
| `onSelect` | `(corporation) => void` | — | 候補確定時 |
| `render` | `(corporation) => Node` | 名称+住所+閉鎖バッジ | 候補 1 件の描画を差し替え |
| `limit` | number | 10 | API の `limit` |
| `minLength` | number | 2 | 検索を開始する最小文字数 |
| `debounce` | number | 250 | ミリ秒 |
| `onError` | `(error) => void` | — | リスト内に「検索できませんでした」を表示した上で呼ぶ |

戻り値: `{ destroy() }`。

### 3.4 挙動の詳細

- **競合制御:** 新しい入力ごとに前のリクエストを `AbortController` で中断。
  古いレスポンスが後着して UI を上書きする事故を防ぐ。
- **キャッシュ:** 法人検索はクエリ文字列単位でメモリキャッシュ（上限 50 件、超過で全クリア）。
- **通信中表示:** 入力欄に `.jpqac-loading` クラスを付与（CSS 側でシマー表示、
  `prefers-reduced-motion` では無効化）。
- **候補リストの位置:** `getBoundingClientRect` で入力欄直下に絶対配置。
  scroll / resize で追従。`z-index` は `--jpqac-z` で調整可能。

## 4. 内部構成

```
jp-qac.js (IIFE)
├─ config / configure()        … baseUrl のみを持つ最小構成
├─ utils: toElement / normalizeDigits / debounce / request / setValue / applyFill
├─ postal()                    … 状態: controller, lastCode
└─ corporate()                 … 状態: controller, items, activeIndex, cache, listbox要素
```

インスタンス状態はすべてクロージャに閉じ、グローバルには `JpQac` のみを追加する。
同一ページに複数の入力欄をアタッチしても互いに干渉しない
（listbox の `id` は連番で一意化）。

## 5. 配布戦略

| フェーズ | 手段 |
|---|---|
| v0.1（現在） | セルフホスト。API サーバーの `public/sdk/` から配信（`/demo/sdk/jp-qac.js`） |
| v0.2 | npm パッケージ `@jp-qac/sdk`（IIFE + ESM のデュアル出力、TypeScript 型定義同梱） |
| v0.3 | CDN（jsDelivr 経由の npm 配信）。SRI ハッシュをリリースノートに記載 |

バージョニングは semver。`JpQac.version` で実行時に確認できる。
公開 API（§3）の破壊的変更はメジャーバージョンでのみ行う。

## 6. セキュリティ / プライバシー

- NTA アプリケーション ID はサーバー側 `.env` のみ。SDK はキーを一切扱わない。
- SDK は入力値を jp-qac API 以外へ送信しない。トラッキングなし。
- 候補描画は `textContent` / `createElement` のみで `innerHTML` 不使用（XSS 対策）。
  `render` を差し替える利用者にも同様の実装を推奨（ドキュメントに明記）。
- CORS: 別オリジンから使う場合はサーバー側で `Access-Control-Allow-Origin` の
  設定が必要（サポート対象の代表的な問い合わせになる想定）。

## 7. テスト計画（v0.2 で導入）

- 正規化・debounce・キャッシュは純関数化して unit test。
- combobox のキーボード操作は Playwright で E2E（ArrowDown/Enter/Escape、
  `aria-activedescendant` の遷移）。
- fetch は既存の Fastify テストサーバー（`test/`）に相乗りして統合テスト。

## 8. 既知の制限 / 今後

- 郵便番号が複数町域にヒットした場合は先頭を採用（`onResult` で独自 UI は可能）。
  → v0.2 で町域選択ドロップダウンを標準装備する。
- Shadow DOM 内の入力欄は未対応（`document.body` への listbox 追加が届かない）。
- IME 変換中の `input` イベントも検索対象になる。実害は小さいが、
  v0.2 で `compositionend` まで待つオプションを検討。

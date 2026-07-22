# jp-qac

日本の郵便番号からの住所入力と、法人名・法人番号検索を提供する API + ブラウザ SDK です。

基本機能は無料で利用できます。利用登録、ライセンスキー、利用回数による課金はありません。環境構築や既存フォームへの組み込みを個別に手伝ってほしい場合だけ、有料サポートを利用できます。

## まず試す

```bash
git clone https://github.com/nishiokya/jp-qac.git
cd jp-qac
npm install
cp .env.example .env
npm run data:postal
npm run dev
```

起動後に開くページ:

- `http://127.0.0.1:3010/demo/lp/` — ライブデモ
- `http://127.0.0.1:3010/demo/tutorial/` — 初心者向けチュートリアル
- `http://127.0.0.1:3010/documentation` — API ドキュメント
- `http://127.0.0.1:3010/demo/sdk/jp-qac.js` / `jp-qac.css` — ブラウザ SDK

詳しい手順とコピーして使える HTML は [docs/tutorial.md](docs/tutorial.md) にあります。SDK の設計と全オプションは [docs/sdk-design.md](docs/sdk-design.md) を参照してください。

試験公開の手順は [docs/deploy.md](docs/deploy.md) にまとめています。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nishiokya/jp-qac)

## API

- `GET /health`
- `GET /v1/postal-codes/:postalCode`
- `GET /v1/corporations?name=...&limit=10`
- `GET /v1/corporations/:corporateNumber`
- `GET /documentation`

成功レスポンスは `{ "data": ..., "meta": ... }`、エラーは `{ "error": { "code", "message", "details?", "requestId" } }` です。

郵便番号は `100-0001`、`１００－０００１`、`1000001` を同じ値として扱います。法人番号も全角数字と区切り文字を正規化します。

## データ

郵便番号データは日本郵便の公式データをダウンロードし、`data/jp-qac.sqlite` に保存します。

法人名検索は、`NTA_APPLICATION_ID` が設定されている場合に国税庁法人番号システム Web-API を利用します。アプリケーション ID はサーバー側にのみ保存され、ブラウザには送信されません。未設定でも郵便番号検索は利用できます。

## コマンド

```bash
npm test             # 単体テスト・APIテスト
npm run typecheck    # TypeScriptの検証
npm run build        # 本番用ビルド
npm start            # dist/server.jsを起動
npm run data:postal  # 日本郵便データを安全に更新
```

## 無料利用とサポート

- API・SDKの基本機能は無料
- セルフホストで利用可能
- ドキュメントとサンプルも無料
- 個別の環境構築、組み込み、運用相談のみ有料サポート
- サポートを利用しなくても機能制限なし

ライセンスは [MIT License](LICENSE) です。

## データ出典

郵便番号データは日本郵便株式会社の公開データを利用しています。

法人データは国税庁法人番号公表サイトの Web-API を利用しています。公開サービスで法人データを表示する場合は、同 API の利用規約で求められる出典・免責表記を掲載してください。

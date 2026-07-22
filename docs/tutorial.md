# jp-qac チュートリアル

このチュートリアルでは、jp-qac を手元で起動し、郵便番号から住所を自動入力するフォームを作ります。法人検索を使わなければ、外部サービスのアカウントやアプリケーション ID は不要です。

## 1. 必要なもの

- Node.js 20 以上
- Git

```bash
node --version
git --version
```

## 2. 起動する

```bash
git clone https://github.com/nishiokya/jp-qac.git
cd jp-qac
npm install
cp .env.example .env
npm run data:postal
npm run dev
```

ブラウザで次を開きます。

- ライブデモ: <http://127.0.0.1:3010/demo/lp/>
- 初心者向けチュートリアル: <http://127.0.0.1:3010/demo/tutorial/>
- API ドキュメント: <http://127.0.0.1:3010/documentation>

郵便番号欄に `100-0001` を入力し、住所が表示されれば準備完了です。

## 3. API を呼ぶ

```bash
curl http://127.0.0.1:3010/v1/postal-codes/100-0001
```

成功すると、`data` に都道府県・市区町村・町域が返ります。郵便番号は `100-0001`、`1000001`、`１００－０００１` の形式を利用できます。

## 4. HTML フォームに組み込む

次を `example.html` として保存し、ブラウザで開きます。

```html
<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<title>住所入力サンプル</title>
<link rel="stylesheet" href="http://127.0.0.1:3010/demo/sdk/jp-qac.css">

<label>郵便番号 <input id="zip" placeholder="100-0001"></label>
<label>都道府県 <input id="prefecture"></label>
<label>市区町村 <input id="city"></label>
<label>町域 <input id="town"></label>

<script src="http://127.0.0.1:3010/demo/sdk/jp-qac.js"></script>
<script>
  JpQac.configure({ baseUrl: "http://127.0.0.1:3010" });
  JpQac.postal("#zip", {
    fill: {
      prefecture: "#prefecture",
      city: "#city",
      town: "#town"
    }
  });
</script>
</html>
```

異なるオリジンのサイトから利用する場合は、そのサイトのオリジンを `.env` の `ALLOWED_ORIGINS` に設定して再起動します。

```dotenv
ALLOWED_ORIGINS=https://www.example.com
```

## 5. 法人名検索を追加する（任意）

法人名・法人番号検索には、国税庁法人番号システム Web-API のアプリケーション ID が必要です。取得した ID を `.env` に設定し、サーバーを再起動します。

```dotenv
NTA_APPLICATION_ID=取得したアプリケーションID
```

アプリケーション ID はサーバー側だけで使われ、SDK やブラウザには送られません。未設定でも郵便番号検索は利用できます。

## 6. 公開前のチェック

```bash
npm test
npm run typecheck
npm run build
npm start
```

- 本番環境では `HOST=0.0.0.0` と公開先が指定する `PORT` を設定する
- `ALLOWED_ORIGINS` は利用する Web サイトだけに絞る
- `NTA_APPLICATION_ID` と `.env` をリポジトリへ追加しない
- `npm run data:postal` で郵便番号データを定期的に更新する
- 国税庁データの表示時は、利用規約で求められる出典・免責表記を掲載する

## トラブルシューティング

### 住所が見つからない

`npm run data:postal` が完了したか確認してください。郵便番号は7桁で指定します。

### 法人検索だけ 503 になる

`NTA_APPLICATION_ID` が未設定です。郵便番号検索はそのまま利用できます。

### 別サイトから呼ぶと 403 になる

呼び出し元のオリジンを `ALLOWED_ORIGINS` に追加し、サーバーを再起動してください。

## サポートについて

API・SDKの基本機能とドキュメントは無料です。環境構築、既存フォームへの組み込み、運用相談などを個別に一緒に進める必要がある場合のみ、有料サポートをご利用いただけます。サポートの利用有無で機能は変わりません。

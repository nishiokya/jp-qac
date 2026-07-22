# 公開する

まず試験公開するための Render 向け設定を `render.yaml` に用意しています。無料インスタンスは検証用です。一定時間アクセスがないと停止し、次のアクセス時は起動に時間がかかります。

## Render へ公開

1. このリポジトリを GitHub へ push する
2. Render Dashboard の **New > Blueprint** を開く
3. `nishiokya/jp-qac` を選択し、`render.yaml` を読み込む
4. デプロイ完了後、`https://jp-qac.onrender.com/health` を開く

法人検索を使う場合だけ、Render の環境変数に `NTA_APPLICATION_ID` を追加して再デプロイします。

公開される主なURL:

- `/demo/lp/` — ライブデモ
- `/demo/tutorial/` — 初心者向けチュートリアル
- `/documentation` — API ドキュメント
- `/health` — 稼働確認

サービス名を `jp-qac` 以外に変えた場合は、Render が発行したURLに合わせて `ALLOWED_ORIGINS` を更新してください。

## 無料インスタンスの注意点

- 15分間アクセスがないと停止し、再起動に1分ほどかかる場合があります。
- ファイルシステムは永続化されません。ただし、郵便番号DBはデプロイごとのビルド時に再生成します。
- 本番用途では、可用性・永続ストレージ・監視を含めて別途構成を検討してください。

## 公開後の確認

```bash
curl https://jp-qac.onrender.com/health
curl https://jp-qac.onrender.com/v1/postal-codes/100-0001
```

画面ではLP、チュートリアル、APIドキュメントを開き、リンク切れ、横スクロール、ブラウザのコンソールエラーがないことを確認します。

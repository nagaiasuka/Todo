# プロジェクト引き継ぎガイド

最終更新: 2026-11-13  
対象リポジトリ: [nagaiasuka/Todo](https://github.com/nagaiasuka/Todo)  
詳しい機能・実装記録: [README.md](../README.md)  
ビルド・公開手順: [RELEASE_GUIDE.md](./RELEASE_GUIDE.md)

## 1. プロジェクト概要

iPhone向けのローカルファーストなタスク管理アプリです。タスクを緊急度・重要度の2軸で4分類し、ホーム画面／ロック画面ウィジェットから優先タスクをすぐ確認・完了できます。

- アプリ内表示名: Todo
- App Store ConnectのEAS設定上の名称: ToDo - ロック画面ウィジェット
- バンドルID: com.nagaiasuka.todo
- ウィジェット拡張ID: com.nagaiasuka.todo.widgets
- App Group: group.com.nagaiasuka.todo
- 技術: Expo SDK 58 / React Native 0.88 / TypeScript / Expo Router
- 対応: iOS 16.4以降。初期リリースではAndroid対象外。
- 保存: 端末内。アカウント、クラウド同期、課金、広告は対象外。

「QUADRACT」は企画時に出た候補で、採用決定ではありません。現行コードとストア設定はTodo系の名称です。変更時はアプリ内表示、App Store Connect、アイコン、ウィジェット名、プライバシー表示、スクリーンショット、ブランド表記を揃えてください。

## 2. プロダクト仕様

### 4分類

| 緊急 | 重要 | 分類 |
|---|---|---|
| はい | はい | 緊急かつ重要 |
| いいえ | はい | 重要だが緊急ではない |
| はい | いいえ | 緊急だが重要ではない |
| いいえ | いいえ | 緊急でも重要でもない |

各分類内は期限日時の昇順、期限なしは後ろ。同じ期限同士は手動順を保ちます。完了タスクは未完了一覧・ウィジェットから外し、復元できます。

### ウィジェット

- ホーム画面: 小・中・大に対応。未完了タスクを表示し、領域に収まらない分を「ほかにあと○件」と示す。
- 表示優先順: 4分類と期限順を使い、緊急性・重要性の高い未完了タスクを先に表示。
- ロック画面: 「今日のタスク数」と「次のタスク」を設定で個別にオン・オフ。
- 「今日」: 端末の現地日付が期限日の未完了タスク。
- 「次」: 期限が最も近い未完了タスク。期限ありのタスクがなければ4分類順から選択。
- iOS 17以降では対応ウィジェットからその場で完了可能。iOS 16の横一行ロック画面表示はタップでアプリを開く。
- WidgetKitの更新時刻はiOSが制御するため、変更直後の即時反映は保証しない。

表示件数は固定値にせず、SwiftUIで実領域と文字サイズを計測して決定します。残件数欄の領域も予約します。ウィジェットはApp Groupに書き出した表示用データを読み、React状態・Hooks・Contextを直接参照しません。メモは共有データに含めません。

### デザイン

企画上の方向性は「仕事の読みやすさ × スポーツの集中・推進力」です。現行実装はオフホワイトを基調に落ち着いたグリーンをアクセントにしたシンプルなデザインです。テーマカラー（グリーン、ブルー、ラベンダー、ローズ、オレンジ、グレー）とオフホワイト／ダーク／端末に合わせる設定があります。4分類の意味は色だけに依存しません。

## 3. 実装状況とリリース状態

実装済み: タスクの追加・編集・削除・完了・復元、期限、メモ、分類内の上下並べ替え、複数の単発リマインダー、毎日／平日／指定曜日の繰り返し通知、ウィジェット、端末内保存と下書き保護。通知予約上限は端末あたり全タスク合計60件です。

検証コマンドは package.json の scripts にあり、typecheck、lint、test、test:widget を使います。READMEにはテスト記録、制約、実機確認項目、診断経緯が詳しくあります。過去のシミュレーター固有問題は、環境と日付を見てから現行の障害か判断してください。

### リリース記録（要再確認）

App Storeの公開ページが確認でき、少なくともアプリ本体は既に公開されています: [ToDo - ロック画面ウィジェット](https://apps.apple.com/jp/app/todo-%E3%83%AD%E3%83%83%E3%82%AF%E7%94%BB%E9%9D%A2%E3%82%A6%E3%82%A3%E3%82%B8%E3%82%A7%E3%83%83%E3%83%88/id6828646484)。READMEでは1.0.0（ビルド6）が公開中、1.1.0（ビルド7）が2026-11-09に審査提出され、当時は WAITING_FOR_REVIEW／承認後自動公開と記録されています。ストア掲載ページだけでは現在の配信バージョンや1.1.0の審査結果は特定できないため、作業時にApp Store Connectで確認してください。

- 提出記録: store/updates/1.1.0-review-receipt.json
- ビルド・検証記録: store/updates/1.1.0-status.json
- 次回以降の手順: [RELEASE_GUIDE.md](./RELEASE_GUIDE.md)

## 4. 開発環境

必要: macOS、Node.js 24（.nvmrc優先）、Xcode、CocoaPods、Apple Developer署名、EASアカウント。ウィジェットはExpo Goでは動かないため、iOS開発ビルド／実機ビルドを使います。

~~~sh
nvm use
npm ci
npm run ios
~~~

画面や保存処理をWebで確認する場合:

~~~sh
npm run web
~~~

Web版ではWidgetKitとiOS通知の実機動作は確認できません。日本語を含むチェックアウトパスでCocoaPodsの文字コードエラーが出た場合は、英数字のみのパスへ置き直してください。シンボリックリンクを介さない実パスを使ってください。

## 5. 設計上の注意

1. app.jsonのConfig Plugin順序を維持する。アプリ所有プラグイン plugins/with-adaptive-todo-widget は expo-widgets より前。
2. SwiftUI描画は plugins/with-adaptive-todo-widget.js がprebuild時に生成物へ組み込む。Expo本体やnode_modulesへの直接パッチは禁止。
3. WidgetKitはApp Group上の共有データを使う。React Nativeの実行状態を参照しない。
4. App Group、通知、App Intent、ネイティブモジュールの変更はiOSアプリと拡張の再ビルドが必要。
5. App Group entitlementはアプリ本体とWidget Extensionの両方で確認。署名の後付けではentitlementは補えない。
6. 完了・削除・未完了への復元・通知予約取消を一緒に確認する。ウィジェット完了連携の詳細はREADMEを参照。
7. iOSのタイムライン更新はOS依存で、即時再描画を前提にしない。
8. 証明書、秘密鍵、APIキー、認証トークンをGitへ追加しない。EAS/Appleの認証保管を使う。

## 6. 変更後の確認

~~~sh
npm run typecheck
npm run lint
npm test
npm run test:widget
npx expo-doctor
npx expo export --platform ios
npx expo export --platform web
~~~

test:widgetはmacOS/XcodeのSwiftコンパイラーが必要です。WidgetKitの実寸、Dynamic Type、壁紙・ダーク表示、App Group共有、ロック画面の設定4通り、通知受信、アプリ終了中の完了操作もSimulator／実機で確認してください。Web表示だけではネイティブ機能を確認できません。

## 7. 引き継ぎ直後のチェックリスト

1. App Store Connectで公開バージョンと審査中バージョンを確認し、リリース状態を更新する。
2. mainの最新コミット、README、package.json、app.json、eas.json、docs/RELEASE_GUIDE.mdを読む。
3. iOS実機またはSimulatorで現行ビルドを起動し、タスク作成・完了、ホーム／ロック画面ウィジェットを確認する。
4. 変更目的と受け入れ条件をIssueまたはPRに書き、小さく変更する。
5. 関連する自動検証を実行し、未実施の実機確認を記録する。
6. ストア申請が必要な場合、バージョン情報・スクリーンショット・審査メモも更新する。

# iOSビルド・デプロイ・App Store公開手順

最終更新: 2026-11-13  
対象リポジトリ: [nagaiasuka/Todo](https://github.com/nagaiasuka/Todo)  
全体の仕様・設計: [PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md)

## 1. 配布経路

このアプリの本番配布先はApple App Storeです。EAS Buildは署名済みiOSビルド（IPA）を作成し、EAS SubmitはApp Store Connectへビルドをアップロードします。アップロードだけではApp Reviewへの提出・公開は完了しません。App Store Connectでビルドを選び、必要なストア情報を揃えて審査に提出します。

このリポジトリにはWebサーバーへの本番デプロイ手順はありません。npm run webは開発用プレビューです。OTA更新の運用も定義されていません。WidgetKit、Swift、App Group、通知、ネイティブモジュール、Config Pluginの変更はApp Store向けアプリを再ビルドしてください。EAS Updateをリリース代わりに使わないでください。

公式手順:
- [Expo: iOS production build](https://docs.expo.dev/tutorial/eas/ios-production-build/)
- [Expo: Submit to the Apple App Store](https://docs.expo.dev/submit/ios/)
- [Apple: App Storeで公開する流れ](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/overview-of-publishing-your-app-on-the-app-store/)
- [Apple: バージョンのリリース方式](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/)

## 2. このリポジトリの配布設定

eas.jsonにproduction build / submit profileがあります。

- build: distribution=store、autoIncrement=true
- appVersionSource=remote: iOS build numberはEAS側で管理・自動増分
- submit:production: App Store ConnectアプリID 6828646484、表示名 ToDo - ロック画面ウィジェット
- app.json: 表示名 Todo、version 1.1.0、bundleIdentifier com.nagaiasuka.todo
- 拡張ID: com.nagaiasuka.todo.widgets
- App Group: group.com.nagaiasuka.todo
- EASプロジェクト: todo-performance

アプリのマーケティングバージョンを更新するときはapp.jsonのexpo.versionを変更します。ビルド番号はEASのautoIncrementを使うため、手動で同じ番号を再利用しないでください。公開アプリのBundle ID、App Group、EAS projectId、Apple Team IDを不用意に変更しないでください。

認証情報・秘密鍵・APIキーはGitへ保存しません。Apple DeveloperとApp Store Connectのアクセス権は適切な担当者に設定し、EASの安全な認証設定を使います。認証を求められたら画面の指示に従い、秘密情報をログ・Issue・READMEへ貼らないでください。

## 3. リリース前チェック

1. App Store Connectで、現在公開中のバージョン、審査中の版、未処理のアップロードを確認する。同じバージョンを二重に作らない。
2. 審査中のビルドがある場合は、継続・取り下げ・置き換えの方針を決めてから新バージョンを作る。
3. Issue/PRを確認し、リリース対象の変更・既知の制約・審査向け説明を確定する。
4. app.jsonのversion、アイコン、ストア説明、更新内容、サポートURL、プライバシー情報、スクリーンショットを確認する。
5. WidgetKit変更ではホーム画面小・中・大、ロック画面形式、App Group権限、対話操作、Dynamic Type、ダーク表示をSimulator／実機で確認する。
6. 通知変更では許可・拒否、単発／繰り返し、完了・削除による取消、通知タップを確認する。
7. 秘密情報やローカル署名ファイルがコミット対象に入っていないか確認する。

## 4. 検証

macOS上で以下を実行します。変更範囲によって対象を調整し、実行結果を記録してください。

~~~sh
nvm use
npm ci
npm run typecheck
npm run lint
npm test
npm run test:widget
npx expo-doctor
npx expo export --platform ios
~~~

test:widgetはmacOS/XcodeのSwiftコンパイラーが必要です。SimulatorのDebugビルドが成功しても、App Store配布署名の証明にはなりません。EAS productionビルドが成功し、アプリ本体とWidget Extensionの署名・App Group entitlementが含まれることを確認してください。

## 5. EASでproductionビルドを作成

mainにリリース対象の変更をマージし、意図したcommitを確認してから実行します。

~~~sh
npx eas-cli@latest whoami
npx eas-cli@latest build --platform ios --profile production --message "1.2.0 release"
~~~

EASに初めて接続する環境では、Apple署名資格情報とApp Store Connect連携を確認します。署名関連の画面では、アプリ本体とWidget Extensionに正しいBundle IDとApp Group entitlementが設定されていることを確認します。署名資格情報をGitに追加する必要はありません。

ビルド完了後、EASのビルド詳細で次を確認します。

- 対象のGit commitとアプリバージョンが意図どおり
- build numberが前回より増えている
- iOSアプリ本体とExpoWidgetsTargetが含まれる
- 配布用署名が成功
- App Group entitlementがアプリと拡張の両方に含まれる
- ビルドログにエラーがない

失敗したらApp Store Connectへ送らず、原因を直して再ビルドします。

## 6. App Store Connectへアップロード

ビルドが成功し、アップロードする成果物が意図した最新ビルドだと確認してから実行します。

~~~sh
npx eas-cli@latest submit --platform ios --profile production --latest
~~~

完了後、App Store ConnectのTestFlightでビルドの処理が終わるまで待ち、ビルド番号・バージョン・処理状態を確認します。EAS Submitはビルドをアップロードする処理です。App Reviewへの提出は次の手順で別途行います。

TestFlightで配布前確認を行う場合は、内部テスターに配り、アプリ起動、タスク保存、通知、ホーム／ロック画面ウィジェットを確認します。外部テスター配布にはApple側のベータ審査が必要になる場合があります。

## 7. App Reviewへ提出して公開

App Store Connectで対象のアプリバージョンを開きます。

1. アップロード済みビルドを選択する。
2. 説明、What's New、キーワード、スクリーンショット、年齢制限、プライバシー情報など必須項目を確認する。
3. ウィジェットや通知の審査メモを最新のビルドに合わせる。テスト手順が必要なら、審査担当者が再現できる内容を記載する。
4. リリース方式を選ぶ。自動公開、手動公開、指定日時公開のどれかを明示的に確認する。
5. 必要な項目がそろったことを確認し、「審査へ提出」を実行する。
6. App Store Connectの状態を追跡し、質問・却下・追加情報依頼に対応する。
7. 公開後、ストア掲載ページのバージョンと実際にダウンロードできるビルドを確認する。

自動公開を選ぶと、Appleの承認後に公開されます。手動公開を選ぶと承認後にApp Store Connectから公開操作が必要です。リリース設定は審査提出前に画面上で確認してください。eas.jsonのsubmit設定だけではApp Review提出・公開方式は決まりません。

## 8. 公開後と失敗時

公開後にApp Storeから最新バージョンをインストールし、起動、既存データの維持、タスク操作、通知、ウィジェットを確認します。ウィジェット・通知の変更は旧インストール状態からの更新でも確認します。

問題が見つかったら、影響範囲と回避策を記録し、修正版を新しいアプリバージョン／ビルド番号で提出します。App Storeの既公開バイナリをGitのrevertだけで置き換えることはできません。緊急時に販売停止などの措置が必要かはApp Store ConnectとAppleの現行手順に従って判断します。

リリースごとに以下を更新してください。

- READMEの実装・検証・リリース記録
- store/updates/<version>-status.json: build ID、version/build number、commit、検証結果、アップロードと審査状態
- store/updates/<version>-review-receipt.json: 提出後の状態と時刻
- App Storeの更新内容、スクリーンショット、審査メモ

記録には公開可能なリリース情報のみを残し、認証情報・秘密鍵・個人の認証トークンは含めないでください。

## 9. 現在の記録と注意

App Storeの公開ページは確認済みです: [ToDo - ロック画面ウィジェット](https://apps.apple.com/jp/app/todo-%E3%83%AD%E3%83%83%E3%82%AF%E7%94%BB%E9%9D%A2%E3%82%A6%E3%82%A3%E3%82%B8%E3%82%A7%E3%83%83%E3%83%88/id6828646484)。READMEとstore/updates/1.1.0-review-receipt.jsonには、1.1.0（build 7）が2026-11-09にApp Reviewへ提出され、記録時点でWAITING_FOR_REVIEW、承認後自動公開設定とあります。公開ページだけでは現在の配信バージョンや審査状況は分からないため、App Store Connectで現状を確認してください。新しいビルドを作る前に、この審査が現在も有効かを確認してください。

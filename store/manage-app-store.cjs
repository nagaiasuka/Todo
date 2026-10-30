// Uses Expo's installed Apple client and its existing authenticated session.
// No credentials or session contents are printed or written by this script.
const fs = require('node:fs');
const path = require('node:path');
const apple = require(process.env.APPLE_UTILS_MODULE || '@expo/apple-utils');
const appId = '6828646484';
const bundleId = 'com.nagaiasuka.todo';

(async () => {
  const auth = await apple.Auth.tryRestoringAuthStateFromUserCredentialsAsync({
    username: process.env.TODO_APPLE_ID,
    teamId: 'R4A5GXYJC6', providerId: 129194983,
  }, {});
  if (!auth) throw Error('Apple session expired. Authenticate with EAS CLI first.');
  const app = await apple.App.infoAsync(auth.context, { id: appId });
  if (app.attributes.bundleId !== bundleId) throw Error('Unexpected app; stopping.');
  const info = await app.getEditAppInfoAsync();
  if (!info) throw Error('No editable app information.');
  const infoLocales = await info.getLocalizationsAsync();
  const jaInfo = infoLocales.find(l => l.attributes.locale === 'ja');
  if (!jaInfo) throw Error('Japanese app information not found.');
  const nameIndex = process.argv.indexOf('--set-name');
  if (nameIndex !== -1) {
    const name = process.argv[nameIndex + 1];
    if (!name || name.length > 30) throw Error('Invalid name.');
    await jaInfo.updateAsync({ name });
    console.log(JSON.stringify({ nameUpdated: name }));
  }
  const version = await app.getEditAppStoreVersionAsync({ platform: 'IOS' });
  if (!version || version.attributes.versionString !== '1.0.0') throw Error('Expected editable version 1.0.0.');
  const locales = await version.getLocalizationsAsync();
  const ja = locales.find(l => l.attributes.locale === 'ja');
  if (!ja) throw Error('Japanese version localization not found.');
  if (process.argv.includes('--replace-pending-lock')) {
    const sets = await ja.getAppScreenshotSetsAsync({query:{includes:['appScreenshots']}});
    const set = sets.find(s=>s.attributes.screenshotDisplayType===apple.ScreenshotDisplayType.APP_IPHONE_67);
    if (!set) throw Error('Screenshot set missing.');
    const shots = set.attributes.appScreenshots || [];
    const old = shots.find(s=>s.attributes.fileName==='01-lock-screen.png');
    const replacement = shots.find(s=>s.attributes.fileName==='01-lock-screen.jpg');
    if (old?.isComplete()) {
      if (replacement) await replacement.deleteAsync();
      console.log('Original PNG completed; kept it and removed the redundant JPEG.');
    } else {
      const uploaded = replacement || await set.uploadScreenshot({filePath:path.join(__dirname,'screenshots/upload-ja-JP/01-lock-screen.jpg'),waitForProcessing:false});
      if (uploaded.isFailed()) throw Error('Replacement screenshot failed.');
      if (old) await old.deleteAsync();
      console.log('Replaced stalled lock-screen PNG with high-quality JPEG.');
    }
  }
  if (process.argv.includes('--upload-screenshots')) {
    const sets = await ja.getAppScreenshotSetsAsync({ query: { includes: ['appScreenshots'] } });
    const type = apple.ScreenshotDisplayType.APP_IPHONE_67;
    const set = sets.find(s => s.attributes.screenshotDisplayType === type) ||
      await ja.createAppScreenshotSetAsync({ screenshotDisplayType: type });
    const existing = set.attributes.appScreenshots || [];
    const dir = path.join(__dirname, 'screenshots/ja-JP');
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort()) {
      const already = existing.find(s => s.attributes.fileName === file && !s.isFailed());
      if (already) { console.log('Already uploaded: ' + file); continue; }
      const shot = await set.uploadScreenshot({ filePath: path.join(dir, file), waitForProcessing: false });
      if (shot.isFailed()) throw Error('Screenshot failed: ' + file);
      console.log('Uploaded: ' + file);
    }
  }
  const sets = await ja.getAppScreenshotSetsAsync({ query: { includes: ['appScreenshots'] } });
  const review = await version.getAppStoreReviewDetailAsync();
  console.log(JSON.stringify({
    appId, primaryLocale: app.attributes.primaryLocale,
    locales: infoLocales.map(l => ({ locale: l.attributes.locale, name: l.attributes.name })),
    version: version.attributes.versionString, state: version.attributes.appStoreState,
    screenshots: sets.map(s => ({ type: s.attributes.screenshotDisplayType, images: (s.attributes.appScreenshots || []).map(i => ({ name: i.attributes.fileName, state: i.attributes.assetDeliveryState })) })),
    reviewContactComplete: !!(review && review.attributes.contactFirstName && review.attributes.contactLastName && review.attributes.contactEmail && review.attributes.contactPhone),
  }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });

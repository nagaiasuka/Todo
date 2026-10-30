// Scope is restricted to this new Todo app. Contact details are copied directly
// from the user's existing app and are never printed or stored in this repo.
const fs = require('node:fs');
const path = require('node:path');
const apple = require(process.env.APPLE_UTILS_MODULE || '@expo/apple-utils');
const id = '6828646484';
const metadata = require('./app-store-ja-JP.json');
const mode = process.argv[2] || 'inspect';
let cachedApiContext;

async function pricingContext() {
  if (cachedApiContext) return cachedApiContext;
  // Resolve only this app's already assigned EAS Submit key, using the same
  // EAS helpers as metadata:push. Keep all key material strictly in memory.
  const easRoot = process.env.APPLE_UTILS_MODULE
    ? path.resolve(process.env.APPLE_UTILS_MODULE, '../../..')
    : path.dirname(require.resolve('eas-cli/package.json'));
  const SessionManager = require(path.join(easRoot,'build/user/SessionManager')).default;
  const { createGraphqlClient } = require(path.join(easRoot,'build/commandUtils/context/contextUtils/createGraphqlClient'));
  const { getAscApiKeyForAppSubmissionsAsync } = require(path.join(easRoot,'build/credentials/ios/api/GraphqlClient'));
  const { AppStoreConnectApiKeyQuery } = require(path.join(easRoot,'build/graphql/queries/AppStoreConnectApiKeyQuery'));
  const session = new SessionManager({setActor(){}});
  const graphql = createGraphqlClient({accessToken:session.getAccessToken(),sessionSecret:session.getSessionSecret()});
  const assigned = await getAscApiKeyForAppSubmissionsAsync(graphql,{account:{name:'asukanagai'},projectName:'todo-performance',bundleIdentifier:'com.nagaiasuka.todo'});
  if (!assigned) throw Error('No EAS Submit key assigned to Todo.');
  const key = await AppStoreConnectApiKeyQuery.getByIdAsync(graphql,assigned.id);
  cachedApiContext = {token:new apple.Token({key:key.keyP8,keyId:key.keyIdentifier,issuerId:key.issuerIdentifier})};
  return cachedApiContext;
}

async function publicRequest(context, method, endpoint, data) {
  const url = new URL(endpoint, 'https://api.appstoreconnect.apple.com');
  if (url.origin !== 'https://api.appstoreconnect.apple.com') throw Error('Unexpected API host.');
  try {
    console.log(`Apple API: ${method.toUpperCase()} ${url.pathname}`);
    return (await apple.getRequestClient().request({method,url:url.href,data,
      headers:{Authorization:`Bearer ${await context.token.getToken()}`,'Content-Type':'application/json'},
    })).data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    const errors = error.response?.data?.errors || [];
    throw Error(`${method.toUpperCase()} ${url.pathname}: ` + (errors.slice(0,3).map(e=>e.detail || e.title).join('\n') || error.message) + (errors.length>3 ? `\n(${errors.length} errors total)` : ''));
  }
}

async function availability(context) {
  const doc = await publicRequest(context,'get',`/v1/apps/${id}/appAvailabilityV2`);
  if (!doc) return null;
  const rows = [];
  let next = `/v2/appAvailabilities/${doc.data.id}/territoryAvailabilities?include=territory&limit=50`;
  while (next) {
    const page = await publicRequest(context,'get',next);
    if (!page) throw Error('Availability details missing.');
    rows.push(...page.data); next = page.links?.next;
  }
  return {availableInNewTerritories:doc.data.attributes.availableInNewTerritories,
    territories:rows.filter(r=>r.attributes.available).map(r=>r.relationships.territory.data.id)};
}

async function pricing(context) {
  const doc = await publicRequest(context,'get',`/v1/apps/${id}/appPriceSchedule?include=baseTerritory`);
  if (!doc) return null;
  const prices = await publicRequest(context,'get',`/v1/appPriceSchedules/${doc.data.id}/manualPrices?include=appPricePoint&limit=200`);
  if (!prices) throw Error('Manual prices missing.');
  const baseTerritory = doc.data.relationships.baseTerritory.data?.id || doc.included?.find(i=>i.type==='territories')?.id;
  if (!baseTerritory) throw Error('Base price territory was not returned.');
  return {baseTerritory,
    manualPrices:prices.data.map(p=>prices.included?.find(i=>i.type==='appPricePoints' && i.id===p.relationships.appPricePoint.data?.id)?.attributes.customerPrice)};
}

(async () => {
  const auth = await apple.Auth.tryRestoringAuthStateFromUserCredentialsAsync({
    username: process.env.TODO_APPLE_ID, teamId: 'R4A5GXYJC6', providerId: 129194983,
  }, {});
  if (!auth) throw Error('Apple session expired; authenticate with EAS CLI.');
  const app = await apple.App.infoAsync(auth.context, { id });
  if (app.attributes.bundleId !== 'com.nagaiasuka.todo') throw Error('Wrong app.');
  let version = await app.getEditAppStoreVersionAsync({ platform: 'IOS' });
  if (!version && mode === 'inspect') version = (await app.getAppStoreVersionsAsync()).find(v=>v.attributes.versionString==='1.0.0');
  if (!version || version.attributes.versionString !== '1.0.0') throw Error('No editable version 1.0.0.');
  let info = await app.getEditAppInfoAsync();
  if (!info && mode === 'inspect') info = (await app.getAppInfoAsync())[0];
  if (!info) throw Error('No editable app information.');
  if (mode === 'age') {
    const age = await info.getAgeRatingDeclarationAsync();
    console.log(JSON.stringify(age?.attributes, null, 2));
    return;
  }

  if (mode === 'prepare') {
    if (!process.argv.includes('--pricing-only')) {
    let review = await version.getAppStoreReviewDetailAsync();
    const complete = r => r && ['contactFirstName','contactLastName','contactEmail','contactPhone'].every(k => r.attributes[k]);
    if (!complete(review)) {
      const apps = (await apple.App.getAsync(auth.context)).filter(a => a.id !== id);
      apps.sort((a,b) => Number(/game/i.test(b.attributes.name)) - Number(/game/i.test(a.attributes.name)));
      let source = null, sourceId = null;
      for (const other of apps) {
        const versions = await other.getAppStoreVersionsAsync();
        for (const v of versions) {
          const candidate = await v.getAppStoreReviewDetailAsync();
          if (complete(candidate)) { source = candidate; sourceId = other.id; break; }
        }
        if (source) break;
      }
      if (!source) throw Error('No complete review contact on existing apps.');
      const contact = Object.fromEntries(['contactFirstName','contactLastName','contactEmail','contactPhone'].map(k => [k,source.attributes[k]]));
      const attrs = { ...contact, demoAccountRequired:false, notes:metadata.reviewNotes };
      if (review) await review.updateAsync(attrs);
      else await apple.AppStoreReviewDetail.createAsync(auth.context, { id:version.id, attributes:attrs });
      console.log('Copied review contact from existing app ' + sourceId + ' (details omitted).');
    } else {
      const contact = Object.fromEntries(['contactFirstName','contactLastName','contactEmail','contactPhone'].map(k => [k,review.attributes[k]]));
      await review.updateAsync({ ...contact, demoAccountRequired:false, notes:metadata.reviewNotes });
      console.log('Review contact already complete.');
    }

    const age = await info.getAgeRatingDeclarationAsync();
    if (!age) throw Error('Age rating declaration unavailable.');
    const ratings = ['alcoholTobaccoOrDrugUseOrReferences','medicalOrTreatmentInformation','profanityOrCrudeHumor','sexualContentOrNudity','gamblingSimulated','horrorOrFearThemes','matureOrSuggestiveThemes','sexualContentGraphicAndNudity','violenceCartoonOrFantasy','violenceRealistic','violenceRealisticProlongedGraphicOrSadistic','contests','gunsOrOtherWeapons'];
    const flags = ['unrestrictedWebAccess','gambling','lootBox','advertising','ageAssurance','healthOrWellnessTopics','messagingAndChat','parentalControls','userGeneratedContent','socialMedia','socialMediaAgeRestricted'];
    // This installed Expo client filters out Apple's newly required social-media
    // fields. Add them to this one age-rating request without changing the SDK.
    const client = apple.getRequestClient();
    const interceptor = client.interceptors.request.use(request => {
      if (request.method === 'patch' && request.url?.includes('ageRatingDeclarations')) {
        const stringBody = typeof request.data === 'string';
        const body = stringBody ? JSON.parse(request.data) : request.data;
        if (body?.data?.id === age.id) {
          Object.assign(body.data.attributes, {socialMedia:false,socialMediaAgeRestricted:false});
          request.data = stringBody ? JSON.stringify(body) : body;
        }
      }
      return request;
    });
    try {
      await age.updateAsync({ ...Object.fromEntries(ratings.map(k=>[k,'NONE'])), ...Object.fromEntries(flags.map(k=>[k,false])), ageRatingOverrideV2:'NONE', koreaAgeRatingOverride:'NONE' });
    } finally { client.interceptors.request.eject(interceptor); }
    console.log('Updated age rating: no restricted content.');

    let usages = await app.getAppDataUsagesAsync();
    if (!usages.length) {
      await app.createAppDataUsageAsync({appDataUsageProtection:'DATA_NOT_COLLECTED'});
      usages = await app.getAppDataUsagesAsync();
    }
    if (!usages.length || usages.some(u=>u.attributes.dataProtection?.id !== 'DATA_NOT_COLLECTED')) throw Error('Unexpected privacy data declarations; refusing to overwrite.');
    const privacyStates = await app.getAppDataUsagesPublishStateAsync();
    if (!privacyStates.length) throw Error('Privacy publish state unavailable.');
    for (const state of privacyStates) if (!state.attributes.published) await state.updateAsync({published:true});
    console.log('Published privacy declaration with no collected data.');
    }

    const apiContext = await pricingContext();
    const points = await apple.AppPricePoint.getForAppAsync(apiContext,{ id,query:{filter:{territory:'JPN'}} });
    const free = points.find(p => Number(p.attributes.customerPrice) === 0);
    if (!free) throw Error('No free Japan price point found.');
    const schedule = await pricing(apiContext);
    if (!schedule) {
      await apple.AppPriceSchedule.createAsync(apiContext,{appId:id,baseTerritoryId:'JPN',manualPrices:[{appPricePointId:free.id,startDate:null}]});
    } else {
      if (schedule.baseTerritory !== 'JPN' || !schedule.manualPrices.length || schedule.manualPrices.some(p=>p == null || Number(p)!==0)) {
        throw Error('Unexpected existing price schedule; refusing to overwrite.');
      }
    }
    const currentAvailability = await availability(apiContext);
    if (!currentAvailability || currentAvailability.availableInNewTerritories || currentAvailability.territories.length!==1 || currentAvailability.territories[0]!=='JPN') {
      const territories = [];
      let nextTerritories = '/v1/territories?limit=200';
      while (nextTerritories) {
        const page = await publicRequest(apiContext,'get',nextTerritories);
        if (!page) throw Error('Territories unavailable.');
        territories.push(...page.data); nextTerritories = page.links?.next;
      }
      if (!territories.some(t=>t.id==='JPN')) throw Error('Japan territory missing.');
      // Apple requires the entire territory matrix on initial creation,
      // including explicit unavailable entries for all non-Japan territories.
      const matrix = territories.map(t=>({type:'territoryAvailabilities',id:'${'+t.id+'}',
        attributes:{available:t.id==='JPN',preOrderEnabled:false,releaseDate:null},
        relationships:{territory:{data:{type:'territories',id:t.id}}},
      }));
      await publicRequest(apiContext,'post','/v2/appAvailabilities',{
        data:{type:'appAvailabilities',attributes:{availableInNewTerritories:false},relationships:{
          app:{data:{type:'apps',id}},territoryAvailabilities:{data:matrix.map(t=>({type:t.type,id:t.id}))},
        }},
        included:matrix,
      });
    }
    await app.updateAsync({ attributes:{contentRightsDeclaration:'DOES_NOT_USE_THIRD_PARTY_CONTENT'} });
    console.log('Configured free distribution in Japan only.');

    const builds = await app.getBuildsAsync();
    const build = builds.find(b=>b.attributes.version === '6' && b.attributes.processingState === 'VALID');
    if (!build) throw Error('Build 6 is not yet VALID in App Store Connect.');
    await version.updateBuildAsync({buildId:build.id});
    console.log('Selected validated build 6.');
  }

  const localizations = await version.getLocalizationsAsync();
  const ja = localizations.find(l=>l.attributes.locale==='ja');
  const sets = ja ? await ja.getAppScreenshotSetsAsync({query:{includes:['appScreenshots']}}) : [];
  const review = await version.getAppStoreReviewDetailAsync();
  const build = await version.getBuildAsync();
  const apiContext = await pricingContext();
  const distribution = await availability(apiContext);
  const price = await pricing(apiContext);
  const infoLocales = await info.getLocalizationsAsync();
  const privacy = await app.getAppDataUsagesPublishStateAsync();
  const status = {
    appId:id, version:version.attributes.versionString, state:version.attributes.appStoreState,
    name:infoLocales.find(l=>l.attributes.locale==='ja')?.attributes.name,
    reviewContactComplete:!!(review && ['contactFirstName','contactLastName','contactEmail','contactPhone'].every(k=>review.attributes[k])),
    selectedBuild:build ? {id:build.id,version:build.attributes.version,processingState:build.attributes.processingState}:null,
    territories:distribution?.territories || [], price, privacyPublished:privacy.some(s=>s.attributes.published),
    screenshots:sets.flatMap(s=>(s.attributes.appScreenshots||[]).map(i=>({name:i.attributes.fileName,state:i.attributes.assetDeliveryState?.state}))),
  };
  if (mode === 'inspect') {
    const submission = await app.getInProgressReviewSubmissionAsync({platform:'IOS'});
    if (submission) status.reviewSubmission = {id:submission.id,state:submission.attributes.state,submittedDate:submission.attributes.submittedDate};
  }
  if (mode === 'submit') {
    if (status.name !== metadata.name || !status.reviewContactComplete || status.selectedBuild?.version !== '6' || !status.privacyPublished || status.territories.length!==1 || status.territories[0]!=='JPN') throw Error('Release prerequisites incomplete: '+JSON.stringify(status));
    if (!price || price.baseTerritory!=='JPN' || !price.manualPrices.length || price.manualPrices.some(p=>p==null || Number(p)!==0)) throw Error('Japan price not confirmed free.');
    if (status.screenshots.length!==4 || status.screenshots.some(s=>s.state!=='COMPLETE')) throw Error('Screenshots not complete: '+JSON.stringify(status.screenshots));
    let submission = await app.getReadyReviewSubmissionAsync({platform:'IOS'});
    if (!submission) submission = await app.createReviewSubmissionAsync({platform:'IOS'});
    const items = await submission.getReviewSubmissionItemsAsync();
    if (!items.some(i=>i.attributes.appStoreVersion?.id===version.id)) await submission.addAppStoreVersionToReviewItems(version.id);
    await submission.submitForReviewAsync();
    const submitted = await apple.ReviewSubmission.infoAsync(auth.context,{id:submission.id});
    status.reviewSubmission = {id:submitted.id,state:submitted.attributes.state,submittedDate:submitted.attributes.submittedDate};
    const refreshed = (await app.getAppStoreVersionsAsync()).find(v=>v.id===version.id);
    if (refreshed) status.state = refreshed.attributes.appStoreState;
    console.log('Submitted for App Review.');
  }
  fs.writeFileSync(path.join(__dirname,'release-status.json'),JSON.stringify(status,null,2)+'\n');
  console.log(JSON.stringify(status,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});

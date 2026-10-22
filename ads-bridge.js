// Optional rewarded ads (Google AdMob) inside the phone app. On the web, or while the ids below are empty, it does nothing and the game shows no ad buttons.
// Follows FAIR-ADS-STANDARD.md: only optional "Watch an ad" rewards on the end-of-level screen, never during a wave, no full-screen interruptions,
// consent (Google UMP) and the iPhone tracking prompt are shown first, and ads still work if the player declines (non-personalized).
// Unit ids below are EMPTY until David creates the AdMob app. Google's public TEST ids are used when TEST is true so nothing real is shown while testing.
(function () {
  var TEST = true;                                  // set to false only for the real store build
  var UNITS = { ios: '', android: '' };             // real rewarded-ad unit ids (ca-app-pub-.../...)
  var TEST_UNITS = { ios: 'ca-app-pub-3940256099942544/1712485313', android: 'ca-app-pub-3940256099942544/5224354917' };
  var ENABLED = false;                              // master switch: stays false until the privacy policy lists AdMob and the store forms are updated
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var AdMob = (C.Plugins && C.Plugins.AdMob) || (C.registerPlugin && C.registerPlugin('AdMob'));
  var plat = C.getPlatform(), unit = TEST ? TEST_UNITS[plat] : UNITS[plat];
  var okInit = false, loaded = false, loading = false;
  function load() {
    if (!ENABLED || !AdMob || !unit || loading) return Promise.resolve(false);
    loading = true;
    return AdMob.prepareRewardVideoAd({ adId: unit, isTesting: TEST }).then(function () { loaded = true; loading = false; return true; }).catch(function () { loaded = false; loading = false; return false; });
  }
  window.ABAds = {
    ready: function () { return ENABLED && okInit && !!unit; },
    init: function () {
      if (!ENABLED || !AdMob || okInit) return Promise.resolve();
      var p = Promise.resolve();
      p = p.then(function () { return AdMob.initialize({ initializeForTesting: TEST }); });
      p = p.then(function () { return AdMob.requestConsentInfo ? AdMob.requestConsentInfo() : null; }).then(function (info) {
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') return AdMob.showConsentForm();
      }).catch(function () {});
      p = p.then(function () { return plat === 'ios' && AdMob.requestTrackingAuthorization ? AdMob.requestTrackingAuthorization() : null; }).catch(function () {});
      return p.then(function () { okInit = true; return load(); });
    },
    // resolves true only if the player watched the ad to the end and earned the reward
    showRewarded: function () {
      if (!this.ready()) return Promise.resolve(false);
      return (loaded ? Promise.resolve(true) : load()).then(function (ok) {
        if (!ok) return false;
        loaded = false;
        return AdMob.showRewardVideoAd().then(function (r) { load(); return !!(r && (r.amount || r.type || r.rewarded !== false)); }).catch(function () { load(); return false; });
      });
    }
  };
})();

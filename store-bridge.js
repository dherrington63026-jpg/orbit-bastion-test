// Connects the game's purchase screens to RevenueCat inside the phone app. On the web it does nothing.
// Sets window.ABStore before game.js runs; game.js asks it what the player owns at every start.
// The keys below are RevenueCat's PUBLIC app keys (appl_... for iPhone, goog_... for Android), safe to ship in the app. They stay EMPTY until David creates the RevenueCat project;
// with no key the game says "the store is not available" and sells nothing.
(function () {
  var KEYS = { ios: '', android: '' };
  // game ids -> store product ids are  PRE + id  (for example orbit_world_glacier). Same ids on Apple and Google.
  var IDS = ['bundle', 'remove_ads',
    'world_glacier', 'world_cinder', 'world_storm', 'world_gale', 'world_solspire', 'world_umbral',
    'pal_inferno', 'pal_frost', 'pal_toxic', 'pal_royal'];
  var PRE = 'orbit_';
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var key = KEYS[C.getPlatform()];
  var RC = (C.Plugins && C.Plugins.Purchases) || (C.registerPlugin && C.registerPlugin('Purchases'));
  if (!key || !RC) return;
  var ready = RC.configure({ apiKey: key });
  function owned(res) {
    var ci = res && (res.customerInfo || res);
    return ((ci && ci.allPurchasedProductIdentifiers) || []).map(function (p) { return p.indexOf(PRE) === 0 ? p.slice(PRE.length) : p; })
      .filter(function (p) { return IDS.indexOf(p) >= 0 || /^lane_/.test(p); });
  }
  var cache = {};
  function products(ids) {
    return RC.getProducts({ productIdentifiers: ids.map(function (i) { return PRE + i; }), type: 'NON_SUBSCRIPTION' }).then(function (r) {
      (r.products || []).forEach(function (p) { cache[p.identifier.replace(PRE, '')] = p; });
      return cache;
    });
  }
  window.ABStore = {
    owned: function () { return ready.then(function () { return RC.getCustomerInfo(); }).then(owned); },
    restore: function () { return ready.then(function () { return RC.restorePurchases(); }).then(owned); },
    buy: function (id) {
      return ready.then(function () { return cache[id] ? cache : products([id]); }).then(function (c) {
        if (!c[id]) throw new Error('product not found: ' + id);
        return RC.purchaseStoreProduct({ product: c[id] });
      }).then(owned);
    },
    prices: function () {
      return ready.then(function () { return products(IDS); }).then(function (c) {
        var out = {}; Object.keys(c).forEach(function (i) { out[i] = c[i].priceString; }); return out;
      });
    }
  };
})();

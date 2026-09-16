import { JSDOM } from 'jsdom';

console.log('Testing Vue.createApp auto-mixin wrapper in JSDOM...');

const html = `<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body>
  <div id="app">
    <div id="roleDisplay">{{ currentRole }}</div>
    <div id="ownerDisplay">{{ ownerRole }}</div>
    <div id="tabSidang" v-show="isRoleAllowed(['Ketua Dewan Adat'])">Sidang Panel</div>
    <div id="tabSurat" v-show="isRoleAllowed(['Juru Tulis'])">Surat Panel</div>
  </div>
  <script>
    // System Injected Pilar 1
    var OWNER_ROLE_NAME = "Ketua Dewan Adat";
    if (typeof window !== 'undefined') window.OWNER_ROLE_NAME = OWNER_ROLE_NAME;

    var Pilar1VueScaffoldMixin = {
      data() {
        return {
          ownerRole: typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : 'Ketua Dewan Adat',
          currentRole: '',
          activeTab: '',
          toast: { visible: false, message: '', type: 'info' }
        };
      },
      methods: {
        isRoleAllowed(roles) {
          if (!this.currentRole) return false;
          var owner = this.ownerRole || (typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : 'Ketua Dewan Adat');
          if (owner && String(this.currentRole).trim().toLowerCase() === String(owner).trim().toLowerCase()) {
            return true;
          }
          if (!roles) return false;
          var allowed = (Array.isArray(roles) ? roles : String(roles).split(',')).map(r => String(r).trim().toLowerCase());
          var cur = String(this.currentRole).trim().toLowerCase();
          return allowed.includes(cur) || allowed.includes('*') || allowed.includes('all');
        },
        loginAs(role) {
          this.currentRole = role;
        },
        logout() {
          this.currentRole = '';
        },
        showTab(tabId) {
          this.activeTab = tabId;
        },
        showToast(msg, type) {
          this.toast = { visible: true, message: msg, type: type || 'info' };
        }
      }
    };

    (function ensureVueAppScaffold() {
      if (typeof Vue !== 'undefined' && Vue.createApp && !Vue.__pilar1Patched) {
        var _origCreateApp = Vue.createApp;
        Vue.createApp = function(rootComp, rootProps) {
          rootComp = rootComp || {};
          rootComp.mixins = rootComp.mixins || [];
          rootComp.mixins.push(Pilar1VueScaffoldMixin);
          var app = _origCreateApp(rootComp, rootProps);
          var _origMount = app.mount;
          app.mount = function(container) {
            var vm = _origMount.call(app, container);
            if (typeof window !== 'undefined') window.vueApp = vm;
            return vm;
          };
          return app;
        };
        Vue.__pilar1Patched = true;
      }
    })();

    // AI generated code: does NOT explicitly define isRoleAllowed or loginAs or logout in methods!
    const app = Vue.createApp({
      data() {
        return {
          customTitle: 'Demo App'
        };
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });

// Poll until Vue finishes loading from CDN and mounts window.vueApp
const start = Date.now();
function checkReady() {
  const win = dom.window as any;
  const vm = win.vueApp;
  if (!vm) {
    if (Date.now() - start > 5000) {
      console.error('❌ FAIL: window.vueApp is not attached within 5s timeout!');
      process.exit(1);
    }
    setTimeout(checkReady, 100);
    return;
  }

  console.log('✅ PASS: window.vueApp attached.');
  console.log('Initial ownerRole:', vm.ownerRole);

  // Login as non-standard owner
  vm.loginAs('Ketua Dewan Adat');
  console.log('After login as owner, isRoleAllowed(["Juru Tulis"]):', vm.isRoleAllowed(['Juru Tulis']));
  if (vm.isRoleAllowed(['Juru Tulis']) !== true) {
    console.error('❌ FAIL: Owner non-standard should have access to all tabs!');
    process.exit(1);
  }
  console.log('✅ PASS: Owner non-standard has full access.');

  // Login as staff
  vm.loginAs('Juru Tulis');
  console.log('After login as Juru Tulis, isRoleAllowed(["Juru Tulis"]):', vm.isRoleAllowed(['Juru Tulis']));
  console.log('After login as Juru Tulis, isRoleAllowed(["Ketua Dewan Adat"]):', vm.isRoleAllowed(['Ketua Dewan Adat']));
  if (vm.isRoleAllowed(['Juru Tulis']) !== true || vm.isRoleAllowed(['Ketua Dewan Adat']) !== false) {
    console.error('❌ FAIL: Role gating for staff is incorrect!');
    process.exit(1);
  }
  console.log('✅ PASS: Staff role gating is 100% correct.');

  // Logout
  vm.logout();
  if (vm.currentRole !== '' || vm.isRoleAllowed(['Juru Tulis']) !== false) {
    console.error('❌ FAIL: Logout failed!');
    process.exit(1);
  }
  console.log('✅ PASS: Logout works properly.');
  console.log('🎉 ALL TESTS PASSED!');
  process.exit(0);
}

checkReady();

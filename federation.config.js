const { withNativeFederation, shareAll, DEFAULT_SKIP_LIST } = require('@angular-architects/native-federation/config');

const EXTRA_SKIP = [
  'ckeditor5',
  '@ckeditor/ckeditor5-angular',
  '@schematics/angular',
  'vite',
  pkg => pkg.startsWith('@angular/cdk/testing'),
  pkg => pkg.startsWith('@angular/') && pkg.includes('/schematics'),
];

module.exports = withNativeFederation({
  name: 'rh',

  exposes: {
    './Routes': './src/app/app.routes.ts',
  },

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: false, requiredVersion: 'auto' },
      { skipList: [...DEFAULT_SKIP_LIST, ...EXTRA_SKIP] }
    ),
    '@angular/core': { singleton: true, strictVersion: false, requiredVersion: '^21.2.0' },
    '@angular/common': { singleton: true, strictVersion: false, requiredVersion: '^21.2.0' },
    '@angular/router': { singleton: true, strictVersion: false, requiredVersion: '^21.2.0' },
    '@angular/platform-browser': {
      singleton: true,
      strictVersion: false,
      requiredVersion: '^21.2.0',
    },
    '@angular/animations': { singleton: true, strictVersion: false, requiredVersion: '^21.2.0' },
    '@angular/animations/browser': {
      singleton: true,
      strictVersion: false,
      requiredVersion: '^21.2.0',
    },
    '@khalilrebhiitec/daf360': { singleton: true, strictVersion: false, requiredVersion: '^4.15.0' },
    '@ngrx/store': { singleton: true, strictVersion: false, requiredVersion: '^21.1.0' },
    '@ngrx/effects': { singleton: true, strictVersion: false, requiredVersion: '^21.1.0' },
    '@ngx-translate/core': {
      singleton: true,
      strictVersion: false,
      requiredVersion: 'auto',
    },
  },
  skip: [
    'rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket',
    'ckeditor5', '@ckeditor/ckeditor5-angular',
    '@schematics/angular', 'vite',
    '@angular/cdk/testing-selenium-webdriver',
  ],
});

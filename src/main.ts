import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));

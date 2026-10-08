// js-aruco2 keeps its modules on `this` (this.CV, this.AR), which ES-module bundles leave undefined. In the
// browser build, vite.config.ts runs each of its files inside a shared context object; under Node they
// stay CommonJS, where `this` is module.exports. Either way the default import carries AR.
import 'js-aruco2/src/cv.js';
import aruco from 'js-aruco2/src/aruco.js';

export default aruco;

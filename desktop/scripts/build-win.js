'use strict';
// Builds the Windows x64 NSIS installer + zip on Linux WITHOUT wine.
//
// electron-builder normally runs a stub installer under wine to extract the
// uninstaller. It already ships a pure-JS extractor (UninstallerReader) that it
// only uses on macOS Catalina+, gated by isMacOsCatalina(). We force that gate
// so the pure-JS path is used here. Exe icon/version stamping is done with
// resedit in scripts/after-pack.js, and signAndEditExecutable=false avoids rcedit.
const macosVersion = require('app-builder-lib/out/util/macosVersion');
macosVersion.isMacOsCatalina = () => true;

const { build, Platform, Arch } = require('electron-builder');

build({
  targets: Platform.WINDOWS.createTarget(null, Arch.x64),
  publish: 'never',
})
  .then((files) => {
    console.log('Built:\n  ' + files.join('\n  '));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

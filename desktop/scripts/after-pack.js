'use strict';
// electron-builder afterPack hook: stamp the Windows exe with the PlanMark icon
// and version info using resedit (pure JS, no wine/rcedit needed). Runs before
// the NSIS/zip targets are built from the unpacked directory.
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { load } = require('resedit/cjs');
  const ResEdit = await load();
  const appInfo = context.packager.appInfo;
  const exePath = path.join(context.appOutDir, `${appInfo.productFilename}.exe`);
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
  if (!fs.existsSync(exePath)) { console.warn('[after-pack] exe not found:', exePath); return; }

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  if (fs.existsSync(icoPath)) {
    const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
    const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
    const target = groups.length ? groups[0] : { id: 1, lang: 1033 };
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries, target.id, target.lang, iconFile.icons.map((i) => i.data)
    );
  }

  const version = appInfo.version; // e.g. 1.0.0
  const parts = version.split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 4) parts.push(0);
  const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const vi = viList.length ? viList[0] : ResEdit.Resource.VersionInfo.createEmpty();
  vi.setFileVersion(...parts, 1033);
  vi.setProductVersion(...parts, 1033);
  const langs = vi.getAllLanguagesForStringValues();
  const lang = langs.length ? langs[0] : { lang: 1033, codepage: 1200 };
  vi.setStringValues(lang, {
    FileDescription: appInfo.productName,
    ProductName: appInfo.productName,
    InternalName: appInfo.productName,
    OriginalFilename: `${appInfo.productFilename}.exe`,
    CompanyName: appInfo.companyName || appInfo.productName,
    LegalCopyright: appInfo.copyright || '',
    FileVersion: version,
    ProductVersion: version,
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('[after-pack] stamped icon + version info into', exePath);
};

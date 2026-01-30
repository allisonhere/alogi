# Arch/CachyOS packaging

Build the unpacked Electron directory, then package it with makepkg.

1) Build the unpacked app
   npm run dist:linux:dir

2) Create the tarball used by PKGBUILD
   tar -C dist-electron -czf packaging/arch/linux-unpacked.tar.gz linux-unpacked

3) Build the package
   cd packaging/arch
   makepkg -f

4) Install locally
   sudo pacman -U alogi-*.pkg.tar.zst

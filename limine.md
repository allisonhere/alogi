# Limine Boot Migration Reference

## Current Setup

- **Limine** (Boot0001) — primary bootloader at `\EFI\LIMINE\BOOTX64.EFI`
- **GRUB** (Boot0003) — fallback at `\EFI\CACHYOS\GRUBX64.EFI`
- **Windows** (Boot0000) — `\EFI\MICROSOFT\BOOT\BOOTMGFW.EFI`
- **Boot order**: Limine -> GRUB -> Windows

## Config Location

- Limine config: `/boot/efi/limine.conf`
- EFI binary: `/boot/efi/EFI/LIMINE/BOOTX64.EFI`
- Source binary: `/usr/share/limine/BOOTX64.EFI`

## If Limine Fails to Boot

1. Press **F12** or **F8** at POST to open firmware boot menu
2. Select **cachyos** (GRUB) to boot normally
3. Once booted, check the config: `cat /boot/efi/limine.conf`

## Revert to GRUB as Default

```bash
sudo efibootmgr -o 0003,0001,0000
```

## Remove Limine Entirely

```bash
sudo efibootmgr -b 0001 -B
sudo rm -rf /boot/efi/EFI/LIMINE
sudo rm /boot/efi/limine.conf
```

## Useful Commands

```bash
# Check boot order
efibootmgr

# Set Limine first again
sudo efibootmgr -o 0001,0003,0000

# Edit limine config
sudo nano /boot/efi/limine.conf

# Reinstall limine binary after package update
sudo cp /usr/share/limine/BOOTX64.EFI /boot/efi/EFI/LIMINE/BOOTX64.EFI
```

## Kernel/Initramfs Paths (btrfs subvol @)

- `/boot/vmlinuz-linux-cachyos`
- `/boot/initramfs-linux-cachyos.img`
- `/boot/amd-ucode.img`
- Root UUID: `28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a`

## Limine 10.x Config Fix

**Problem**: "no valid entries" error on boot. The config was using the old Limine format (`:Entry Name`, `protocol: linux_x86_64`, `verbose: yes`) which is incompatible with Limine 10.x.

**Fix**: Updated config to v10.x format:
- Entry delimiter changed from `:` to `/`
- Protocol changed from `linux_x86_64` to `linux`
- Removed `verbose` and `default_entry` (no longer valid)

**Working config** (`/boot/efi/limine.conf`):

```
timeout: 10

/CachyOS
    protocol: linux
    kernel_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/@/boot/vmlinuz-linux-cachyos
    module_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/@/boot/amd-ucode.img
    module_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/@/boot/initramfs-linux-cachyos.img
    cmdline: root=UUID=28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a rootflags=subvol=@ rw

/CachyOS (fallback)
    protocol: linux
    kernel_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/boot/vmlinuz-linux-cachyos
    module_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/boot/amd-ucode.img
    module_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/boot/initramfs-linux-cachyos.img
    cmdline: root=UUID=28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a rootflags=subvol=@ rw
```

**Status**: Untested — remove whichever path style (`/@/boot` vs `/boot`) doesn't work after rebooting.

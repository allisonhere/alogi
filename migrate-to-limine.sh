#!/bin/bash
set -euo pipefail

# GRUB to Limine migration script
# Run as root: sudo bash migrate-to-limine.sh

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash migrate-to-limine.sh"
    exit 1
fi

echo "=== Deploying Limine EFI binaries ==="
mkdir -p /boot/efi/EFI/LIMINE
cp /usr/share/limine/BOOTX64.EFI /boot/efi/EFI/LIMINE/BOOTX64.EFI

echo "=== Writing limine.conf to ESP ==="
cat > /boot/efi/limine.conf << 'EOF'
timeout: 5
default_entry: 1

:CachyOS
    protocol: linux_x86_64
    kernel_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/@/boot/vmlinuz-linux-cachyos
    module_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/@/boot/amd-ucode.img
    module_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/@/boot/initramfs-linux-cachyos.img
    cmdline: root=UUID=28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a rootflags=subvol=@ rw

:CachyOS LTS
    protocol: linux_x86_64
    kernel_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/@/boot/vmlinuz-linux-cachyos-lts
    module_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/@/boot/amd-ucode.img
    module_path: uuid(28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a):/@/boot/initramfs-linux-cachyos-lts.img
    cmdline: root=UUID=28d17d3f-45b4-4fbb-a11b-4fa4fdd5e99a rootflags=subvol=@ rw
EOF

echo "=== Setting Limine as default boot entry ==="
# Remove old Limine entry if it exists
efibootmgr -b 0005 -B 2>/dev/null || true
# Create new Limine entry pointing to correct filename
efibootmgr --create --disk /dev/disk/by-partuuid/d1961588-bc6e-4a99-9e2a-97495c19f3af --part 1 --label "Limine" --loader "\\EFI\\LIMINE\\BOOTX64.EFI"
# Set boot order: Limine first, then GRUB fallback, then Windows
LIMINE_NUM=$(efibootmgr | grep -i limine | grep -oP 'Boot\K[0-9]+')
efibootmgr -o "${LIMINE_NUM}",0003,0000

echo "=== Done! ==="
echo "Boot order is now: Limine -> GRUB (fallback) -> Windows"
echo "GRUB is still installed — use firmware boot menu (F12/F8) to select it if Limine fails."
echo "Reboot when ready."

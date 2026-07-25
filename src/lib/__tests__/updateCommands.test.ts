import { describe, expect, it } from 'vitest';
import { buildCommands } from '../updateCommands';

const archUrl = 'https://example.test/alogi-arch.pkg.tar.zst';
const rpmUrl = 'https://example.test/Alogi-x86_64.rpm';

describe('update install commands', () => {
  it('recommends the release RPM on DNF systems', () => {
    const commands = buildCommands(
      { archPackageUrl: archUrl, rpmPackageUrl: rpmUrl },
      { hasPacman: false, hasParu: false, hasYay: false, hasDnf: true },
    );

    expect(commands.primary).toEqual({
      label: 'Install with DNF',
      command: `curl -L "${rpmUrl}" -o "/tmp/Alogi-x86_64.rpm" && sudo dnf install "/tmp/Alogi-x86_64.rpm"`,
    });
    expect(commands.alternatives).toEqual([]);
  });

  it('keeps the existing AUR recommendation on Arch systems', () => {
    const commands = buildCommands(
      { archPackageUrl: archUrl, rpmPackageUrl: rpmUrl },
      { hasPacman: true, hasParu: true, hasYay: true, hasDnf: false },
    );

    expect(commands.primary).toEqual({ label: 'Use paru', command: 'paru -S alogi' });
    expect(commands.alternatives).toContainEqual({ label: 'Use yay', command: 'yay -S alogi' });
  });

  it('does not suggest DNF without a published RPM asset', () => {
    const commands = buildCommands(
      { archPackageUrl: null, rpmPackageUrl: null },
      { hasPacman: false, hasParu: false, hasYay: false, hasDnf: true },
    );

    expect(commands.primary).toBeNull();
  });
});

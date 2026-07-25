export type CommandOption = {
  label: string;
  command: string;
};

type PackageUrls = {
  archPackageUrl: string | null;
  rpmPackageUrl: string | null;
};

type PackageEnvironment = {
  hasPacman: boolean;
  hasParu: boolean;
  hasYay: boolean;
  hasDnf: boolean;
};

function buildDirectInstallCommand(archPackageUrl: string): CommandOption {
  const filename = archPackageUrl.split('/').pop() || 'alogi.pkg.tar.zst';
  const targetPath = `/tmp/${filename}`;

  return {
    label: 'Direct package install',
    command: `curl -L "${archPackageUrl}" -o "${targetPath}" && sudo pacman -U "${targetPath}"`,
  };
}

function buildDnfInstallCommand(rpmPackageUrl: string): CommandOption {
  const filename = rpmPackageUrl.split('/').pop() || 'Alogi-x86_64.rpm';
  const targetPath = `/tmp/${filename}`;

  return {
    label: 'Install with DNF',
    command: `curl -L "${rpmPackageUrl}" -o "${targetPath}" && sudo dnf install "${targetPath}"`,
  };
}

export function buildCommands(
  packageUrls: PackageUrls,
  environment: PackageEnvironment,
): { primary: CommandOption | null; alternatives: CommandOption[] } {
  const alternatives: CommandOption[] = [];
  const { archPackageUrl, rpmPackageUrl } = packageUrls;

  if (environment.hasPacman) {
    const directCommand = archPackageUrl ? buildDirectInstallCommand(archPackageUrl) : null;

    if (environment.hasParu) {
      if (directCommand) alternatives.push(directCommand);
      if (environment.hasYay) {
        alternatives.push({ label: 'Use yay', command: 'yay -S alogi' });
      }
      return {
        primary: { label: 'Use paru', command: 'paru -S alogi' },
        alternatives,
      };
    }

    if (environment.hasYay) {
      if (directCommand) alternatives.push(directCommand);
      return {
        primary: { label: 'Use yay', command: 'yay -S alogi' },
        alternatives,
      };
    }

    return {
      primary: directCommand,
      alternatives,
    };
  }

  if (environment.hasDnf && rpmPackageUrl) {
    return {
      primary: buildDnfInstallCommand(rpmPackageUrl),
      alternatives,
    };
  }

  return {
    primary: null,
    alternatives,
  };
}

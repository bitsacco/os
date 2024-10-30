/**
 * This script runs migrations for all packages that have a `migrate` script in their `package.json`.
 * As a prerequisite, the script installs the dependencies of each package.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function findPackagesWithMigrations(dir: string): string[] {
  const packages: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      const packageJsonPath = path.join(fullPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.scripts && packageJson.scripts["migrate:dev"]) {
          packages.push(fullPath);
        }
      }
      // Recursively search in subdirectories
      packages.push(...findPackagesWithMigrations(fullPath));
    }
  }

  return packages;
}

function runMigrations(): void {
  const packagesWithMigrations = findPackagesWithMigrations('.');

  for (const packagePath of packagesWithMigrations) {
    try {
      execSync('bun install', { cwd: packagePath, stdio: 'inherit' });
      execSync('bun run migrate:dev', { cwd: packagePath, stdio: 'inherit' });
    } catch (error) {
      console.error(`Error running migrations for ${packagePath}:`, error);
    }
  }
}

runMigrations();

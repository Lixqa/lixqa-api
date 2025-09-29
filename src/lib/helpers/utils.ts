import fs from 'fs';
import path from 'path';

export function findFilesRecursive(
  dir: string,
  condition: (entry: fs.Dirent<string>) => boolean,
) {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findFilesRecursive(fullPath, condition));
    } else if (entry.isFile() && condition(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

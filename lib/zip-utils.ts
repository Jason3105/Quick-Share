/**
 * zip-utils.ts
 * Client-side folder zipping using JSZip.
 * Preserves the full directory structure via webkitRelativePath.
 */

export interface ZipProgress {
  phase: "reading" | "compressing" | "finalizing";
  percent: number; // 0-100
  currentFile?: string;
}

/**
 * Takes an array of File objects (from a webkitdirectory input) and
 * returns a single File object (.zip) with the full directory tree preserved.
 *
 * @param files     Files selected via <input webkitdirectory>
 * @param onProgress  Progress callback called during compression
 * @returns A File object representing the zipped folder
 */
export async function zipFolder(
  files: File[],
  onProgress?: (progress: ZipProgress) => void
): Promise<File> {
  // Dynamic import so JSZip is only loaded when folder mode is used
  const JSZip = (await import("jszip")).default;

  const zip = new JSZip();

  // Phase 1: Read all files and add to zip
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // webkitRelativePath looks like "folderName/subdir/file.txt"
    const path =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;

    onProgress?.({
      phase: "reading",
      percent: Math.round((i / files.length) * 40), // 0-40%
      currentFile: path,
    });

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    zip.file(path, buffer);
  }

  // Phase 2: Generate the zip with streaming progress
  onProgress?.({ phase: "compressing", percent: 40 });

  const blob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }, // balanced speed vs size
    },
    (metadata) => {
      // metadata.percent is 0-100 during compression
      onProgress?.({
        phase: metadata.percent < 100 ? "compressing" : "finalizing",
        percent: 40 + Math.round(metadata.percent * 0.6), // 40-100%
      });
    }
  );

  // Derive zip filename from the top-level folder name
  const folderName = getFolderName(files);
  const zipFileName = `${folderName}.zip`;

  return new File([blob], zipFileName, { type: "application/zip" });
}

/**
 * Extracts the top-level folder name from a list of files with webkitRelativePath.
 */
export function getFolderName(files: File[]): string {
  if (files.length === 0) return "folder";
  const first = files[0] as File & { webkitRelativePath?: string };
  const path = first.webkitRelativePath || first.name;
  return path.split("/")[0] || "folder";
}

/**
 * Calculates total size of all files in bytes.
 */
export function getTotalSize(files: File[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}

/**
 * Builds a simple tree structure for preview display.
 * Returns at most maxItems entries to keep the UI lightweight.
 */
export interface TreeNode {
  name: string;
  isDir: boolean;
  children?: TreeNode[];
}

export function buildFileTree(files: File[], maxDepth = 3): TreeNode {
  const root: TreeNode = { name: getFolderName(files), isDir: true, children: [] };

  for (const file of files) {
    const relativePath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const parts = relativePath.split("/").slice(1); // skip root folder name

    if (parts.length === 0) continue;

    let current = root;
    let depth = 0;
    for (; depth < Math.min(parts.length - 1, maxDepth); depth++) {
      const dirName = parts[depth];
      let dir = current.children?.find((c) => c.isDir && c.name === dirName);
      if (!dir) {
        dir = { name: dirName, isDir: true, children: [] };
        current.children = current.children || [];
        current.children.push(dir);
      }
      current = dir;
    }

    // Add the file leaf
    const fileName = parts[parts.length - 1];
    current.children = current.children || [];
    current.children.push({ name: fileName, isDir: false });
  }

  return root;
}

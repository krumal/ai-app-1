import { describe, expect, test } from "bun:test";
import {
  resolveProjectDirectoryPicker,
  stripTrailingPathSeparators,
} from "./config";

function availableCommands(commands: string[]) {
  const commandSet = new Set(commands);
  return (command: string) => commandSet.has(command);
}

describe("project directory picker resolution", () => {
  test("uses AppleScript on macOS", async () => {
    const picker = await resolveProjectDirectoryPicker("darwin", availableCommands([]));

    expect(picker.command).toEqual([
      "osascript",
      "-e",
      'set pickedFolder to choose folder with prompt "Select a repository"',
      "-e",
      "POSIX path of pickedFolder",
    ]);
    expect(picker.isCancel(1, "User canceled.")).toBe(true);
    expect(picker.isCancel(1, "execution error: User canceled. (-128)")).toBe(true);
    expect(picker.isCancel(1, "Permission denied")).toBe(false);
  });

  test("uses Windows Forms through PowerShell on Windows", async () => {
    const picker = await resolveProjectDirectoryPicker("win32", availableCommands([]));

    expect(picker.command.slice(0, 4)).toEqual([
      "powershell.exe",
      "-NoProfile",
      "-STA",
      "-Command",
    ]);
    expect(picker.command[4]).toContain("System.Windows.Forms.FolderBrowserDialog");
    expect(picker.command[4]).toContain("Write-Output $dialog.SelectedPath");
    expect(picker.isCancel(1, "")).toBe(false);
  });

  test("prefers zenity on Linux", async () => {
    const picker = await resolveProjectDirectoryPicker(
      "linux",
      availableCommands(["zenity", "kdialog", "yad"]),
    );

    expect(picker.command[0]).toBe("zenity");
    expect(picker.command).toContain("--directory");
    expect(picker.isCancel(1, "")).toBe(true);
    expect(picker.isCancel(2, "Unexpected failure")).toBe(false);
  });

  test("falls back to kdialog on Linux", async () => {
    const picker = await resolveProjectDirectoryPicker("linux", availableCommands(["kdialog"]));

    expect(picker.command.slice(0, 4)).toEqual([
      "kdialog",
      "--title",
      "Select a repository",
      "--getexistingdirectory",
    ]);
  });

  test("falls back to yad on Linux", async () => {
    const picker = await resolveProjectDirectoryPicker("linux", availableCommands(["yad"]));

    expect(picker.command).toEqual([
      "yad",
      "--file",
      "--directory",
      "--title=Select a repository",
    ]);
  });

  test("explains the Linux dependency when no dialog command exists", async () => {
    await expect(resolveProjectDirectoryPicker("linux", availableCommands([]))).rejects.toThrow(
      "Install zenity, kdialog, or yad",
    );
  });

  test("keeps filesystem root intact when trimming selected paths", () => {
    expect(stripTrailingPathSeparators("/")).toBe("/");
    expect(stripTrailingPathSeparators("/Users/timur/project/")).toBe("/Users/timur/project");
    expect(stripTrailingPathSeparators("/Users/timur/project//")).toBe("/Users/timur/project");
  });
});

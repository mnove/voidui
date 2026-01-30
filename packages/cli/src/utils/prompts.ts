import prompts from "prompts";
import type { ChangeType } from "../types/changelog.js";

export async function promptForChange(): Promise<{
  type: ChangeType;
  description: string;
} | null> {
  const response = await prompts([
    {
      type: "select",
      name: "type",
      message: "Change type:",
      choices: [
        { title: "✨ Added", value: "added" as ChangeType },
        { title: "🔄 Changed", value: "changed" as ChangeType },
        { title: "⚠️  Deprecated", value: "deprecated" as ChangeType },
        { title: "🗑️  Removed", value: "removed" as ChangeType },
        { title: "🐛 Fixed", value: "fixed" as ChangeType },
        { title: "🔒 Security", value: "security" as ChangeType },
      ],
    },
    {
      type: "text",
      name: "description",
      message: "Change description:",
      validate: (value: string) =>
        value.length > 0 ? true : "Description cannot be empty",
    },
  ]);

  if (!response.type || !response.description) {
    return null;
  }

  return {
    type: response.type,
    description: response.description,
  };
}

export async function promptForMore(message: string): Promise<boolean> {
  const response = await prompts({
    type: "confirm",
    name: "more",
    message,
    initial: false,
  });

  return response.more ?? false;
}

export async function promptForBreaking(): Promise<boolean> {
  const response = await prompts({
    type: "confirm",
    name: "breaking",
    message: "Is this a breaking change?",
    initial: false,
  });

  return response.breaking ?? false;
}

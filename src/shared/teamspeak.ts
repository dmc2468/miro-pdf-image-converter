export function meetUrlFromTeamSpeakDescription(description: string | undefined): string | undefined {
  const match = description?.match(/https?:\/\/meet\.google\.com\/[^\s<>"'\[\]]+/);
  return match?.[0]?.replace(/[),.;]+$/, "");
}

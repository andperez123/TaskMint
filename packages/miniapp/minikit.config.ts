const ROOT_URL = process.env.NEXT_PUBLIC_URL ?? "https://trytaskmint.vercel.app";

export const minikitConfig = {
  // Sign your manifest at https://www.base.dev/preview?tab=account
  // then paste the accountAssociation here:
  accountAssociation: {
    header: "",
    payload: "",
    signature: "",
  },
  miniapp: {
    version: "1",
    name: "Taskmint",
    subtitle: "Onchain bounties, verified and paid",
    description:
      "Post and complete bounties escrowed on Base. Verify tasks onchain — transactions, social actions, or test results — and get paid.",
    screenshotUrls: [],
    iconUrl: `${ROOT_URL}/icon.png`,
    splashImageUrl: `${ROOT_URL}/splash.png`,
    splashBackgroundColor: "#122f57",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "developer-tools",
    tags: ["bounties", "onchain", "base", "agents", "farcaster"],
    heroImageUrl: `${ROOT_URL}/splash.png`,
    tagline: "Onchain bounties, verified and paid",
    ogTitle: "Taskmint",
    ogDescription:
      "Post funded bounties on Base. Complete tasks. Get verified onchain. Get paid.",
    ogImageUrl: `${ROOT_URL}/splash.png`,
  },
} as const;

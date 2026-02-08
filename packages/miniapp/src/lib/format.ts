import { formatEther } from "viem";

/** Shorten 0x address to 0x1234...abcd */
export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

/** Format wei to ETH with up to 4 decimal places */
export function formatReward(wei: bigint): string {
  const eth = formatEther(wei);
  const num = parseFloat(eth);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toFixed(4).replace(/\.?0+$/, "");
}

/** Relative time from now (e.g. "3d left" or "expired") */
export function timeLeft(deadlineUnix: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadlineUnix - now;
  if (diff <= 0) return "Expired";
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
  return `${Math.floor(diff / 86400)}d left`;
}

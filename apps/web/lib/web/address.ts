import { BlockList, isIP } from "node:net";

/**
 * Is this IP address somewhere on the public internet? A bot reading the web must never be
 * steered into this machine, the user's network, or a cloud metadata service.
 */

const v4 = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
] as const)
  v4.addSubnet(net, bits, "ipv4");

const v6Special = new BlockList();
for (const [net, bits] of [
  ["2001::", 23], // IANA special purpose (Teredo, benchmarking, ORCHID…)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4: wraps an IPv4 address, often a private one
] as const)
  v6Special.addSubnet(net, bits, "ipv6");

/** The eight 16-bit groups of an IPv6 address (with a dotted IPv4 tail expanded). */
function groups(ip: string): number[] {
  let s = ip.toLowerCase();
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (tail) {
    const [a, b, c, d] = tail[1].split(".").map(Number);
    s = s.slice(0, -tail[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, rest] = s.split("::");
  const h = head ? head.split(":") : [];
  const r = rest !== undefined && rest !== "" ? rest.split(":") : [];
  const fill = rest === undefined ? [] : Array(8 - h.length - r.length).fill("0");
  return [...h, ...fill, ...r].map((g) => parseInt(g, 16));
}

const embeddedV4 = (g: number[]) => `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;

export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !v4.check(ip, "ipv4");
  if (family !== 6) return false;
  const g = groups(ip);
  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) addresses reach an IPv4 host.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPublicAddress(embeddedV4(g));
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPublicAddress(embeddedV4(g));
  // Only global unicast (2000::/3) is public; that rules out ::, ::1, fc00::/7, fe80::/10, ff00::/8…
  if ((g[0] & 0xe000) !== 0x2000) return false;
  return !v6Special.check(ip, "ipv6");
}

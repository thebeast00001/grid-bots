import { isPublicAddress } from "./address";

test.each([
  "93.184.216.34",
  "8.8.8.8",
  "1.1.1.1",
  "172.32.0.1", // just outside 172.16/12
  "100.128.0.1", // just outside CGNAT
  "2606:4700:4700::1111",
  "2001:4860:4860::8888",
  "::ffff:8.8.8.8", // IPv4-mapped public
  "64:ff9b::808:808", // NAT64 of 8.8.8.8
])("%s is public", (ip) => {
  expect(isPublicAddress(ip)).toBe(true);
});

test.each([
  "127.0.0.1",
  "127.255.255.254",
  "10.1.2.3",
  "172.16.0.1",
  "172.31.255.255",
  "192.168.1.1",
  "169.254.169.254", // cloud metadata
  "100.64.0.1",
  "0.0.0.0",
  "224.0.0.1",
  "255.255.255.255",
  "198.18.0.1",
  "192.0.2.1",
  "::",
  "::1",
  "fe80::1",
  "fc00::1",
  "fd12:3456::1",
  "ff02::1",
  "::ffff:127.0.0.1",
  "::ffff:7f00:1", // the same, written in hex
  "::ffff:10.0.0.1",
  "64:ff9b::a00:1", // NAT64 of 10.0.0.1
  "2002:7f00:1::1", // 6to4 of 127.0.0.1
  "2001:db8::1",
  "not an ip",
  "",
])("%s is not public", (ip) => {
  expect(isPublicAddress(ip)).toBe(false);
});

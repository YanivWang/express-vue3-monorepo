import { randomBytes } from "node:crypto";

const buf = randomBytes(8);

console.log("Buffer（Node 默认视图）:", buf);
console.log("");

console.log("每个字节在内存里就是 8 个二进制位，下面按「字节」拆开打印：");
for (let i = 0; i < buf.length; i++) {
  const n = buf[i];
  const bits8 = n.toString(2).padStart(8, "0");
  console.log(`  字节 ${i}: 十进制 ${n.toString().padStart(3)} | 十六进制 0x${n.toString(16).padStart(2, "0")} | 二进制 ${bits8}`);
}

console.log("");
console.log("8 字节接在一起的 64 位（仅作展示，中间无空格，和上面按顺序拼接一致）：");
console.log("  " + [...buf].map((b) => b.toString(2).padStart(8, "0")).join(""));

/**
每个字节在内存里就是 8 个二进制位，下面按「字节」拆开打印：
  字节 0: 十进制 202 | 十六进制 0xca | 二进制 11001010
  字节 1: 十进制 194 | 十六进制 0xc2 | 二进制 11000010
  字节 2: 十进制  64 | 十六进制 0x40 | 二进制 01000000
  字节 3: 十进制  15 | 十六进制 0x0f | 二进制 00001111
  字节 4: 十进制 111 | 十六进制 0x6f | 二进制 01101111
  字节 5: 十进制  65 | 十六进制 0x41 | 二进制 01000001
  字节 6: 十进制 186 | 十六进制 0xba | 二进制 10111010
  字节 7: 十进制 208 | 十六进制 0xd0 | 二进制 11010000

8 字节接在一起的 64 位（仅作展示，中间无空格，和上面按顺序拼接一致）：
  1100101011000010010000000000111101101111010000011011101011010000
 */

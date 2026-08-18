import fs from 'fs';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generateIcon(size, isMaskable = false) {
  // Create RGBA image buffer
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (1 + width * 4));

  const center = size / 2;
  const cornerRadius = isMaskable ? 0 : size * 0.22;

  // Colors: Gradient background from #0284c7 (top left) to #0f172a (bottom right)
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Distance from center
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check rounded rect boundary (if not maskable)
      let inside = true;
      if (!isMaskable) {
        const qx = Math.max(Math.abs(dx) - (center - cornerRadius), 0);
        const qy = Math.max(Math.abs(dy) - (center - cornerRadius), 0);
        const cornerDist = Math.sqrt(qx * qx + qy * qy);
        if (cornerDist > cornerRadius) {
          inside = false;
        }
      }

      if (!inside) {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // Background gradient
      const t = (x + y) / (width + height);
      let r = Math.round(2 + t * (15 - 2));
      let g = Math.round(132 + t * (23 - 132));
      let b = Math.round(199 + t * (42 - 199));

      // Draw Game Controller icon in center
      // Scaled coordinates relative to size
      const normX = dx / (size * 0.4);
      const normY = dy / (size * 0.4);

      // Controller body: rounded oval rectangle
      const ctrlDist = Math.sqrt(Math.max(0, Math.abs(normX) - 0.4)**2 + Math.max(0, Math.abs(normY) - 0.2)**2);
      const inController = (Math.abs(normX) < 0.85 && Math.abs(normY) < 0.55 && ctrlDist < 0.45);
      
      // Grips (bottom wings)
      const leftGrip = Math.sqrt((normX + 0.6)**2 + (normY - 0.45)**2) < 0.32;
      const rightGrip = Math.sqrt((normX - 0.6)**2 + (normY - 0.45)**2) < 0.32;

      // D-Pad on left
      const inDpadH = (Math.abs(normX + 0.42) < 0.18 && Math.abs(normY) < 0.06);
      const inDpadV = (Math.abs(normX + 0.42) < 0.06 && Math.abs(normY) < 0.18);
      const inDpad = inDpadH || inDpadV;

      // Action buttons on right (diamond layout)
      const btnX = normX - 0.42;
      const inBtnTop = Math.sqrt(btnX**2 + (normY + 0.12)**2) < 0.06;
      const inBtnBottom = Math.sqrt(btnX**2 + (normY - 0.12)**2) < 0.06;
      const inBtnLeft = Math.sqrt((btnX + 0.12)**2 + normY**2) < 0.06;
      const inBtnRight = Math.sqrt((btnX - 0.12)**2 + normY**2) < 0.06;
      const inActionBtns = inBtnTop || inBtnBottom || inBtnLeft || inBtnRight;

      // Center Sprint chevron/gem
      const inCenterGem = Math.abs(normX) + Math.abs(normY) < 0.12;

      if (inDpad) {
        // Cyan / Blue D-pad
        r = 56; g = 189; b = 248;
      } else if (inBtnTop) {
        // Yellow button
        r = 251; g = 191; b = 36;
      } else if (inBtnBottom) {
        // Green button
        r = 52; g = 211; b = 153;
      } else if (inBtnLeft) {
        // Cyan button
        r = 56; g = 189; b = 248;
      } else if (inBtnRight) {
        // Rose button
        r = 251; g = 113; b = 133;
      } else if (inCenterGem) {
        // Gold glowing center
        r = 255; g = 215; b = 0;
      } else if (inController || leftGrip || rightGrip) {
        // Dark slate controller shell with sleek gradient
        const shellShade = 0.8 + 0.2 * normY;
        r = Math.round(30 * shellShade);
        g = Math.round(41 * shellShade);
        b = Math.round(59 * shellShade);
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = 255;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
}

// Generate files in public/assets/
fs.writeFileSync('public/assets/icon-192.png', generateIcon(192, false));
fs.writeFileSync('public/assets/icon-512.png', generateIcon(512, false));
fs.writeFileSync('public/assets/icon-maskable-512.png', generateIcon(512, true));
fs.writeFileSync('public/assets/apple-touch-icon.png', generateIcon(180, false));
fs.writeFileSync('public/favicon.ico', generateIcon(32, false));

console.log('Icons generated successfully.');

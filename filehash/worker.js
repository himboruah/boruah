importScripts('./lib/spark-md5.min.js');
importScripts('./lib/sha.js');
importScripts('./lib/sha3.min.js');
importScripts('./lib/hash-wasm.js');
importScripts('./lib/bcryptjs.min.js');

self.onmessage = async (ev) => {
  const { taskId, action = "hash" } = ev.data || {};
  const post = (type, data) => self.postMessage(Object.assign({ type, taskId }, data || {}));
  const postResult = (algo, hex) => post("result", { algo, hex });

  const hexFromBuffer = (buf) => [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  const hexToU8 = (hex) => Uint8Array.from((hex.match(/.{1,2}/g) || []).map(b=>parseInt(b,16)));
  const toB64 = (u8) => btoa(String.fromCharCode(...u8));
  const fromB64 = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const nfkc = (s) => (s || "").normalize('NFKC');
  const trimOneTrailingNewline = (s) => s.replace(/\r?\n$/, '');

  async function runScrypt(passU8, saltU8, N, r, p, dkLen) {
    if (self.hashwasm && typeof self.hashwasm.scrypt === 'function') {
      const hex = await self.hashwasm.scrypt({
        password: passU8, salt: saltU8,
        costFactor: N, blockSize: r, parallelism: p,
        hashLength: dkLen, outputType: 'hex',
      });
      return hexToU8(hex);
    }
    if (self.scrypt && typeof self.scrypt.scrypt === 'function') {
      return await self.scrypt.scrypt(passU8, saltU8, N, r, p, dkLen);
    }
    if (typeof self.scrypt === 'function') {
      return await new Promise((resolve, reject) => {
        try {
          const out = new Uint8Array(dkLen);
          const maybe = self.scrypt(passU8, saltU8, N, r, p, out, (err) => err ? reject(err) : resolve(out));
          if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
        } catch (e) { reject(e); }
      });
    }
    throw new Error("No scrypt implementation detected. Ensure hash-wasm is loaded.");
  }

  function getBcrypt() {
    if (self.dcodeIO && self.dcodeIO.bcrypt) return self.dcodeIO.bcrypt;
    if (self.bcrypt) return self.bcrypt;
    return null;
  }

  const makeMD5 = () => new self.SparkMD5.ArrayBuffer();
  const makeSHA1 = () => new self.jsSHA("SHA-1", "ARRAYBUFFER");
  const makeSHA256 = () => new self.jsSHA("SHA-256", "ARRAYBUFFER");
  const makeSHA384 = () => new self.jsSHA("SHA-384", "ARRAYBUFFER");
  const makeSHA512 = () => new self.jsSHA("SHA-512", "ARRAYBUFFER");
  const makeSHA3_224 = () => self.sha3_224.create();
  const makeSHA3_256 = () => self.sha3_256.create();
  const makeSHA3_384 = () => self.sha3_384.create();
  const makeSHA3_512 = () => self.sha3_512.create();
  const makeKeccak224 = () => self.keccak224.create();
  const makeKeccak256 = () => self.keccak256.create();
  const makeKeccak384 = () => self.keccak384.create();
  const makeKeccak512 = () => self.keccak512.create();

  async function makeBlake3()  { return await self.hashwasm.createBLAKE3(); }
  async function makeBlake2b() { return await self.hashwasm.createBLAKE2b(); }
  async function makeBlake2s() { return await self.hashwasm.createBLAKE2s(); }
  async function makeXXH32()   { return await self.hashwasm.createXXHash32(); }
  async function makeXXH64()   { return await self.hashwasm.createXXHash64(); }

  function makePHC_pbkdf2(iter, saltU8, hashU8) {
    return `$pbkdf2-sha256$i=${iter}$${toB64(saltU8)}$${toB64(hashU8)}`;
  }
  function makePHC_argon2id(t, m, p, saltU8, hashU8) {
    return `$argon2id$v=19$m=${m},t=${t},p=${p}$${toB64(saltU8)}$${toB64(hashU8)}`;
  }
  function makePHC_scrypt(ln, r, p, saltU8, hashU8) {
    return `$scrypt$ln=${ln},r=${r},p=${p}$${toB64(saltU8)}$${toB64(hashU8)}`;
  }

  async function handleVerifyKdf(password, phc, pepper = "") {
    try {
      const norm = trimOneTrailingNewline(nfkc(password)) + (pepper || "");
      if (!phc || phc[0] !== '$') return post("verify-kdf-result", { ok: false, algo: null });

      const parts = phc.split('$').filter(Boolean);
      const id = parts[0];

      if (id === 'pbkdf2-sha256') {
        const params = (parts[1] || '');
        const m = params.match(/i=(\d+)/);
        if (!m) throw new Error("Invalid PBKDF2 params");
        const iter = parseInt(m[1], 10);
        const salt = fromB64(parts[2] || "");
        const expect = fromB64(parts[3] || "");
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(norm), { name: "PBKDF2" }, false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: iter, salt }, key, expect.length * 8);
        const got = new Uint8Array(bits);
        const ok = (got.length === expect.length) && got.every((v,i) => v === expect[i]);
        return post("verify-kdf-result", { ok, algo: 'PBKDF2-HMAC-SHA256' });
      }

      if (id === 'argon2id') {
        const params = (parts[2] || '');
        const mm = params.match(/m=(\d+),t=(\d+),p=(\d+)/);
        if (!mm) throw new Error("Invalid Argon2 params");
        const m = parseInt(mm[1], 10), t = parseInt(mm[2], 10), p = parseInt(mm[3], 10);
        const salt = fromB64(parts[3] || "");
        const expect = fromB64(parts[4] || "");
        const hex = await self.hashwasm.argon2id({
          password: norm, salt,
          parallelism: p, iterations: t, memorySize: m,
          hashLength: expect.length, outputType: 'hex',
        });
        const got = hexToU8(hex);
        const ok = (got.length === expect.length) && got.every((v,i) => v === expect[i]);
        return post("verify-kdf-result", { ok, algo: 'Argon2id' });
      }

      if (id === 'scrypt') {
        const params = (parts[1] || '');
        const mm = params.match(/ln=(\d+),r=(\d+),p=(\d+)/);
        if (!mm) throw new Error("Invalid scrypt params");
        const ln = parseInt(mm[1], 10), r = parseInt(mm[2], 10), p = parseInt(mm[3], 10);
        const N = 1 << ln;
        const salt = fromB64(parts[2] || "");
        const expect = fromB64(parts[3] || "");
        const out = await runScrypt(new TextEncoder().encode(norm), salt, N, r, p, expect.length);
        const ok = out.length === expect.length && out.every((v,i)=>v===expect[i]);
        return post("verify-kdf-result", { ok, algo: 'scrypt' });
      }

      if (/^2[aby]$/.test(id)) {
        const bcrypt = getBcrypt();
        if (!bcrypt) throw new Error("bcrypt library not available");
        const ok = bcrypt.compareSync(norm, phc);
        return post("verify-kdf-result", { ok, algo: 'bcrypt' });
      }

      return post("verify-kdf-result", { ok: false, algo: null });
    } catch (e) {
      return post("error", { msg: e?.message || String(e) });
    }
  }

  if (action === "verifyKdf") {
    const { password, phc, pepper } = ev.data || {};
    return handleVerifyKdf(password, phc, pepper);
  }

  const { payload, algos = [], kdfs = {} } = ev.data || {};

  try {
    if (payload.kind === "text") {
      const bytes = payload.bytes;
      const rawText = new TextDecoder().decode(bytes);
      const normText = trimOneTrailingNewline(nfkc(rawText));
      const normBytes = new TextEncoder().encode(normText);

      if (algos.includes("MD5"))      { const s = makeMD5(); s.append(normBytes.buffer); postResult("MD5", s.end()); }
      if (algos.includes("SHA-1"))    { const s = makeSHA1(); s.update(normBytes.buffer); postResult("SHA-1", s.getHash("HEX")); }
      if (algos.includes("SHA-256"))  { const s = makeSHA256(); s.update(normBytes.buffer); postResult("SHA-256", s.getHash("HEX")); }
      if (algos.includes("SHA-384"))  { const s = makeSHA384(); s.update(normBytes.buffer); postResult("SHA-384", s.getHash("HEX")); }
      if (algos.includes("SHA-512"))  { const s = makeSHA512(); s.update(normBytes.buffer); postResult("SHA-512", s.getHash("HEX")); }
      if (algos.includes("SHA3-224")) { const h = makeSHA3_224(); h.update(normBytes); postResult("SHA3-224", h.hex()); }
      if (algos.includes("SHA3-256")) { const h = makeSHA3_256(); h.update(normBytes); postResult("SHA3-256", h.hex()); }
      if (algos.includes("SHA3-384")) { const h = makeSHA3_384(); h.update(normBytes); postResult("SHA3-384", h.hex()); }
      if (algos.includes("SHA3-512")) { const h = makeSHA3_512(); h.update(normBytes); postResult("SHA3-512", h.hex()); }
      if (algos.includes("Keccak-224")) { const h = makeKeccak224(); h.update(normBytes); postResult("Keccak-224", h.hex()); }
      if (algos.includes("Keccak-256")) { const h = makeKeccak256(); h.update(normBytes); postResult("Keccak-256", h.hex()); }
      if (algos.includes("Keccak-384")) { const h = makeKeccak384(); h.update(normBytes); postResult("Keccak-384", h.hex()); }
      if (algos.includes("Keccak-512")) { const h = makeKeccak512(); h.update(normBytes); postResult("Keccak-512", h.hex()); }
      if (algos.includes("SHAKE128")) { postResult("SHAKE128", self.shake128(normBytes, 256)); }
      if (algos.includes("SHAKE256")) { postResult("SHAKE256", self.shake256(normBytes, 256)); }
      if (algos.includes("BLAKE3"))  { const h = await makeBlake3(); h.init(); h.update(normBytes); postResult("BLAKE3", h.digest("hex")); }
      if (algos.includes("BLAKE2b")) { const h = await makeBlake2b(); h.init(); h.update(normBytes); postResult("BLAKE2b", h.digest("hex")); }
      if (algos.includes("BLAKE2s")) { const h = await makeBlake2s(); h.init(); h.update(normBytes); postResult("BLAKE2s", h.digest("hex")); }
      if (algos.includes("XXH32"))   { const h = await makeXXH32(); h.init(); h.update(normBytes); postResult("XXH32", h.digest("hex")); }
      if (algos.includes("XXH64"))   { const h = await makeXXH64(); h.init(); h.update(normBytes); postResult("XXH64", h.digest("hex")); }

      if (kdfs?.pbkdf2) {
        const salt = hexToU8(kdfs.pbkdf2.saltHex);
        const pwd = nfkc(normText + (kdfs.pbkdf2.pepper || ""));
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pwd), { name: "PBKDF2" }, false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits(
          { name: "PBKDF2", hash: "SHA-256", iterations: kdfs.pbkdf2.iter, salt },
          key,
          256
        );
        const u8 = new Uint8Array(bits);
        postResult("PBKDF2-HMAC-SHA256", hexFromBuffer(u8.buffer));
        postResult("PBKDF2 (PHC)", makePHC_pbkdf2(kdfs.pbkdf2.iter, salt, u8));
      }

      if (kdfs?.argon2) {
        const salt = hexToU8(kdfs.argon2.saltHex);
        const pwd = nfkc(normText + (kdfs.argon2.pepper || ""));
        const hex = await self.hashwasm.argon2id({
          password: pwd,
          salt,
          parallelism: kdfs.argon2.p,
          iterations:  kdfs.argon2.t,
          memorySize:  kdfs.argon2.m,
          hashLength:  32,
          outputType: 'hex',
        });
        const u8 = hexToU8(hex);
        postResult("Argon2id", hex);
        postResult("Argon2id (PHC)", makePHC_argon2id(kdfs.argon2.t, kdfs.argon2.m, kdfs.argon2.p, salt, u8));
      }

      if (kdfs?.scrypt) {
        const salt = hexToU8(kdfs.scrypt.saltHex);
        const pwd = nfkc(normText + (kdfs.scrypt.pepper || ""));
        const passU8 = new TextEncoder().encode(pwd);
        const N = 1 << kdfs.scrypt.ln;
        const out = await runScrypt(passU8, salt, N, kdfs.scrypt.r, kdfs.scrypt.p, kdfs.scrypt.len);
        postResult("scrypt", hexFromBuffer(out.buffer));
        postResult("scrypt (PHC)", makePHC_scrypt(kdfs.scrypt.ln, kdfs.scrypt.r, kdfs.scrypt.p, salt, out));
      }

      if (kdfs?.bcrypt) {
        const bcrypt = getBcrypt();
        if (!bcrypt) throw new Error("bcrypt library not available");
        const cost = parseInt(kdfs.bcrypt.cost, 10) || 12;
        const pwd = nfkc(normText + (kdfs.bcrypt.pepper || ""));
        const mcf = bcrypt.hashSync(pwd, cost);
        postResult("bcrypt (MCF)", String(mcf));
      }

      post("done");
      return;
    }

    const total = payload.size;
    let processed = 0;
    const states = {};

    if (algos.includes("MD5"))     states.MD5   = new self.SparkMD5.ArrayBuffer();
    if (algos.includes("SHA-1"))   states.SHA1  = new self.jsSHA("SHA-1", "ARRAYBUFFER");
    if (algos.includes("SHA-256")) states.S256  = new self.jsSHA("SHA-256", "ARRAYBUFFER");
    if (algos.includes("SHA-384")) states.S384  = new self.jsSHA("SHA-384", "ARRAYBUFFER");
    if (algos.includes("SHA-512")) states.S512  = new self.jsSHA("SHA-512", "ARRAYBUFFER");
    if (algos.includes("SHA3-224")) states.S3_224 = self.sha3_224.create();
    if (algos.includes("SHA3-256")) states.S3_256 = self.sha3_256.create();
    if (algos.includes("SHA3-384")) states.S3_384 = self.sha3_384.create();
    if (algos.includes("SHA3-512")) states.S3_512 = self.sha3_512.create();
    if (algos.includes("Keccak-224")) states.K224 = self.keccak224.create();
    if (algos.includes("Keccak-256")) states.K256 = self.keccak256.create();
    if (algos.includes("Keccak-384")) states.K384 = self.keccak384.create();
    if (algos.includes("Keccak-512")) states.K512 = self.keccak512.create();

    if (algos.includes("BLAKE3"))  states.B3  = await makeBlake3();
    if (algos.includes("BLAKE2b")) states.B2b = await makeBlake2b();
    if (algos.includes("BLAKE2s")) states.B2s = await makeBlake2s();
    if (algos.includes("XXH32"))   states.X32 = await makeXXH32();
    if (algos.includes("XXH64"))   states.X64 = await makeXXH64();

    if (states.B3)  states.B3.init();
    if (states.B2b) states.B2b.init();
    if (states.B2s) states.B2s.init();
    if (states.X32) states.X32.init();
    if (states.X64) states.X64.init();

    let needShake128Buffer = false;
    let needShake256Buffer = false;
    let shakeChunks = null;
    let shakeTotal = 0;
    if (algos.includes("SHAKE128")) {
      if (self.shake128 && typeof self.shake128.create === "function") {
        states.SK128 = self.shake128.create(256);
      } else { needShake128Buffer = true; }
    }
    if (algos.includes("SHAKE256")) {
      if (self.shake256 && typeof self.shake256.create === "function") {
        states.SK256 = self.shake256.create(256);
      } else { needShake256Buffer = true; }
    }
    if (needShake128Buffer || needShake256Buffer) {
      shakeChunks = [];
      shakeTotal = 0;
    }

    post("ready");

    self.onmessage = (ev2) => {
      const { chunk, done } = ev2.data || {};
      if (chunk) {
        const u8 = new Uint8Array(chunk);

        if (states.MD5)    states.MD5.append(chunk);
        if (states.SHA1)   states.SHA1.update(chunk);
        if (states.S256)   states.S256.update(chunk);
        if (states.S384)   states.S384.update(chunk);
        if (states.S512)   states.S512.update(chunk);
        if (states.S3_224) states.S3_224.update(u8);
        if (states.S3_256) states.S3_256.update(u8);
        if (states.S3_384) states.S3_384.update(u8);
        if (states.S3_512) states.S3_512.update(u8);
        if (states.K224)   states.K224.update(u8);
        if (states.K256)   states.K256.update(u8);
        if (states.K384)   states.K384.update(u8);
        if (states.K512)   states.K512.update(u8);
        if (states.B3)     states.B3.update(u8);
        if (states.B2b)    states.B2b.update(u8);
        if (states.B2s)    states.B2s.update(u8);
        if (states.X32)    states.X32.update(u8);
        if (states.X64)    states.X64.update(u8);

        if (states.SK128)  states.SK128.update(u8);
        if (states.SK256)  states.SK256.update(u8);
        if (shakeChunks) { shakeChunks.push(u8); shakeTotal += u8.byteLength; }

        processed += u8.byteLength;
        post("progress", { pct: (processed/total)*100, label: processed === total ? "Finalizing…" : undefined });
        return;
      }
      if (done) {
        if (states.MD5)    postResult("MD5",        states.MD5.end());
        if (states.SHA1)   postResult("SHA-1",      states.SHA1.getHash("HEX"));
        if (states.S256)   postResult("SHA-256",    states.S256.getHash("HEX"));
        if (states.S384)   postResult("SHA-384",    states.S384.getHash("HEX"));
        if (states.S512)   postResult("SHA-512",    states.S512.getHash("HEX"));
        if (states.S3_224) postResult("SHA3-224",   states.S3_224.hex());
        if (states.S3_256) postResult("SHA3-256",   states.S3_256.hex());
        if (states.S3_384) postResult("SHA3-384",   states.S3_384.hex());
        if (states.S3_512) postResult("SHA3-512",   states.S3_512.hex());
        if (states.K224)   postResult("Keccak-224", states.K224.hex());
        if (states.K256)   postResult("Keccak-256", states.K256.hex());
        if (states.K384)   postResult("Keccak-384", states.K384.hex());
        if (states.K512)   postResult("Keccak-512", states.K512.hex());
        if (states.B3)     postResult("BLAKE3",     states.B3.digest("hex"));
        if (states.B2b)    postResult("BLAKE2b",    states.B2b.digest("hex"));
        if (states.B2s)    postResult("BLAKE2s",    states.B2s.digest("hex"));
        if (states.X32)    postResult("XXH32",      states.X32.digest("hex"));
        if (states.X64)    postResult("XXH64",      states.X64.digest("hex"));

        if (states.SK128)  postResult("SHAKE128",   states.SK128.hex());
        if (states.SK256)  postResult("SHAKE256",   states.SK256.hex());
        if (shakeChunks && (needShake128Buffer || needShake256Buffer)) {
          const all = new Uint8Array(shakeTotal);
          let off = 0; for (const c of shakeChunks) { all.set(c, off); off += c.byteLength; }
          if (needShake128Buffer) postResult("SHAKE128", self.shake128(all, 256));
          if (needShake256Buffer) postResult("SHAKE256", self.shake256(all, 256));
        }

        post("done");
      }
    };
  } catch (err) {
    post("error", { msg: err?.message || String(err) });
  }
};

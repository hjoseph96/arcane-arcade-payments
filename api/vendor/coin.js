const Crypto = require('cryptojs').Crypto;
const {
  ripemd160
} = require('./ripemd160')
const {
  EllipticCurve
} = require('./ellipticcurve')
const randomBytes = require('random-bytes')

require('dotenv').config()

// Copyright (c) 2005  Tom Wu
// All Rights Reserved.
// See "LICENSE" for details.

// Basic JavaScript BN library - subset useful for RSA encryption.

// Bits per digit
var dbits;

// JavaScript engine analysis
var canary = 0xdeadbeefcafe;
var j_lm = ((canary & 0xffffff) == 0xefcafe);

// (public) Constructor
function BigInteger(a, b, c) {
  if (!(this instanceof BigInteger)) {
    return new BigInteger(a, b, c);
  }

  if (a != null) {
    if ("number" == typeof a) this.fromNumber(a, b, c);
    else if (b == null && "string" != typeof a) this.fromString(a, 256);
    else this.fromString(a, b);
  }
}

var proto = BigInteger.prototype;

// return new, unset BigInteger
function nbi() {
  return new BigInteger(null);
}

// am: Compute w_j += (x*this_i), propagate carries,
// c is initial carry, returns final carry.
// c < 3*dvalue, x < 2*dvalue, this_i < dvalue
// We need to select the fastest one that works in this environment.

// am1: use a single mult and divide to get the high bits,
// max digit bits should be 26 because
// max internal value = 2*dvalue^2-2*dvalue (< 2^53)
function am1(i, x, w, j, c, n) {
  while (--n >= 0) {
    var v = x * this[i++] + w[j] + c;
    c = Math.floor(v / 0x4000000);
    w[j++] = v & 0x3ffffff;
  }
  return c;
}
// am2 avoids a big mult-and-extract completely.
// Max digit bits should be <= 30 because we do bitwise ops
// on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
function am2(i, x, w, j, c, n) {
  var xl = x & 0x7fff,
    xh = x >> 15;
  while (--n >= 0) {
    var l = this[i] & 0x7fff;
    var h = this[i++] >> 15;
    var m = xh * l + h * xl;
    l = xl * l + ((m & 0x7fff) << 15) + w[j] + (c & 0x3fffffff);
    c = (l >>> 30) + (m >>> 15) + xh * h + (c >>> 30);
    w[j++] = l & 0x3fffffff;
  }
  return c;
}
// Alternately, set max digit bits to 28 since some
// browsers slow down when dealing with 32-bit numbers.
function am3(i, x, w, j, c, n) {
  var xl = x & 0x3fff,
    xh = x >> 14;
  while (--n >= 0) {
    var l = this[i] & 0x3fff;
    var h = this[i++] >> 14;
    var m = xh * l + h * xl;
    l = xl * l + ((m & 0x3fff) << 14) + w[j] + c;
    c = (l >> 28) + (m >> 14) + xh * h;
    w[j++] = l & 0xfffffff;
  }
  return c;
}

// wtf?
BigInteger.prototype.am = am1;
dbits = 26;

/*
if(j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
  BigInteger.prototype.am = am2;
  dbits = 30;
}
else if(j_lm && (navigator.appName != "Netscape")) {
  BigInteger.prototype.am = am1;
  dbits = 26;
}
else { // Mozilla/Netscape seems to prefer am3
  BigInteger.prototype.am = am3;
  dbits = 28;
}
*/

BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = ((1 << dbits) - 1);
var DV = BigInteger.prototype.DV = (1 << dbits);

var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2, BI_FP);
BigInteger.prototype.F1 = BI_FP - dbits;
BigInteger.prototype.F2 = 2 * dbits - BI_FP;

// Digit conversions
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr, vv;
rr = "0".charCodeAt(0);
for (vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
rr = "a".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
rr = "A".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

function int2char(n) {
  return BI_RM.charAt(n);
}

function intAt(s, i) {
  var c = BI_RC[s.charCodeAt(i)];
  return (c == null) ? -1 : c;
}

// (protected) copy this to r
function bnpCopyTo(r) {
  for (var i = this.t - 1; i >= 0; --i) r[i] = this[i];
  r.t = this.t;
  r.s = this.s;
}

// (protected) set from integer value x, -DV <= x < DV
function bnpFromInt(x) {
  this.t = 1;
  this.s = (x < 0) ? -1 : 0;
  if (x > 0) this[0] = x;
  else if (x < -1) this[0] = x + DV;
  else this.t = 0;
}

// return bigint initialized to value
function nbv(i) {
  var r = nbi();
  r.fromInt(i);
  return r;
}

// (protected) set from string and radix
function bnpFromString(s, b) {
  var self = this;

  var k;
  if (b == 16) k = 4;
  else if (b == 8) k = 3;
  else if (b == 256) k = 8; // byte array
  else if (b == 2) k = 1;
  else if (b == 32) k = 5;
  else if (b == 4) k = 2;
  else {
    self.fromRadix(s, b);
    return;
  }
  self.t = 0;
  self.s = 0;
  var i = s.length,
    mi = false,
    sh = 0;
  while (--i >= 0) {
    var x = (k == 8) ? s[i] & 0xff : intAt(s, i);
    if (x < 0) {
      if (s.charAt(i) == "-") mi = true;
      continue;
    }
    mi = false;
    if (sh == 0)
      self[self.t++] = x;
    else if (sh + k > self.DB) {
      self[self.t - 1] |= (x & ((1 << (self.DB - sh)) - 1)) << sh;
      self[self.t++] = (x >> (self.DB - sh));
    } else
      self[self.t - 1] |= x << sh;
    sh += k;
    if (sh >= self.DB) sh -= self.DB;
  }
  if (k == 8 && (s[0] & 0x80) != 0) {
    self.s = -1;
    if (sh > 0) self[self.t - 1] |= ((1 << (self.DB - sh)) - 1) << sh;
  }
  self.clamp();
  if (mi) BigInteger.ZERO.subTo(self, self);
}

// (protected) clamp off excess high words
function bnpClamp() {
  var c = this.s & this.DM;
  while (this.t > 0 && this[this.t - 1] == c) --this.t;
}

// (public) return string representation in given radix
function bnToString(b) {
  var self = this;
  if (self.s < 0) return "-" + self.negate().toString(b);
  var k;
  if (b == 16) k = 4;
  else if (b == 8) k = 3;
  else if (b == 2) k = 1;
  else if (b == 32) k = 5;
  else if (b == 4) k = 2;
  else return self.toRadix(b);
  var km = (1 << k) - 1,
    d, m = false,
    r = "",
    i = self.t;
  var p = self.DB - (i * self.DB) % k;
  if (i-- > 0) {
    if (p < self.DB && (d = self[i] >> p) > 0) {
      m = true;
      r = int2char(d);
    }
    while (i >= 0) {
      if (p < k) {
        d = (self[i] & ((1 << p) - 1)) << (k - p);
        d |= self[--i] >> (p += self.DB - k);
      } else {
        d = (self[i] >> (p -= k)) & km;
        if (p <= 0) {
          p += self.DB;
          --i;
        }
      }
      if (d > 0) m = true;
      if (m) r += int2char(d);
    }
  }
  return m ? r : "0";
}

// (public) -this
function bnNegate() {
  var r = nbi();
  BigInteger.ZERO.subTo(this, r);
  return r;
}

// (public) |this|
function bnAbs() {
  return (this.s < 0) ? this.negate() : this;
}

// (public) return + if this > a, - if this < a, 0 if equal
function bnCompareTo(a) {
  var r = this.s - a.s;
  if (r != 0) return r;
  var i = this.t;
  r = i - a.t;
  if (r != 0) return (this.s < 0) ? -r : r;
  while (--i >= 0)
    if ((r = this[i] - a[i]) != 0) return r;
  return 0;
}

// returns bit length of the integer x
function nbits(x) {
  var r = 1,
    t;
  if ((t = x >>> 16) != 0) {
    x = t;
    r += 16;
  }
  if ((t = x >> 8) != 0) {
    x = t;
    r += 8;
  }
  if ((t = x >> 4) != 0) {
    x = t;
    r += 4;
  }
  if ((t = x >> 2) != 0) {
    x = t;
    r += 2;
  }
  if ((t = x >> 1) != 0) {
    x = t;
    r += 1;
  }
  return r;
}

// (public) return the number of bits in "this"
function bnBitLength() {
  if (this.t <= 0) return 0;
  return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ (this.s & this.DM));
}

// (protected) r = this << n*DB
function bnpDLShiftTo(n, r) {
  var i;
  for (i = this.t - 1; i >= 0; --i) r[i + n] = this[i];
  for (i = n - 1; i >= 0; --i) r[i] = 0;
  r.t = this.t + n;
  r.s = this.s;
}

// (protected) r = this >> n*DB
function bnpDRShiftTo(n, r) {
  for (var i = n; i < this.t; ++i) r[i - n] = this[i];
  r.t = Math.max(this.t - n, 0);
  r.s = this.s;
}

// (protected) r = this << n
function bnpLShiftTo(n, r) {
  var self = this;
  var bs = n % self.DB;
  var cbs = self.DB - bs;
  var bm = (1 << cbs) - 1;
  var ds = Math.floor(n / self.DB),
    c = (self.s << bs) & self.DM,
    i;
  for (i = self.t - 1; i >= 0; --i) {
    r[i + ds + 1] = (self[i] >> cbs) | c;
    c = (self[i] & bm) << bs;
  }
  for (i = ds - 1; i >= 0; --i) r[i] = 0;
  r[ds] = c;
  r.t = self.t + ds + 1;
  r.s = self.s;
  r.clamp();
}

// (protected) r = this >> n
function bnpRShiftTo(n, r) {
  var self = this;
  r.s = self.s;
  var ds = Math.floor(n / self.DB);
  if (ds >= self.t) {
    r.t = 0;
    return;
  }
  var bs = n % self.DB;
  var cbs = self.DB - bs;
  var bm = (1 << bs) - 1;
  r[0] = self[ds] >> bs;
  for (var i = ds + 1; i < self.t; ++i) {
    r[i - ds - 1] |= (self[i] & bm) << cbs;
    r[i - ds] = self[i] >> bs;
  }
  if (bs > 0) r[self.t - ds - 1] |= (self.s & bm) << cbs;
  r.t = self.t - ds;
  r.clamp();
}

// (protected) r = this - a
function bnpSubTo(a, r) {
  var self = this;
  var i = 0,
    c = 0,
    m = Math.min(a.t, self.t);
  while (i < m) {
    c += self[i] - a[i];
    r[i++] = c & self.DM;
    c >>= self.DB;
  }
  if (a.t < self.t) {
    c -= a.s;
    while (i < self.t) {
      c += self[i];
      r[i++] = c & self.DM;
      c >>= self.DB;
    }
    c += self.s;
  } else {
    c += self.s;
    while (i < a.t) {
      c -= a[i];
      r[i++] = c & self.DM;
      c >>= self.DB;
    }
    c -= a.s;
  }
  r.s = (c < 0) ? -1 : 0;
  if (c < -1) r[i++] = self.DV + c;
  else if (c > 0) r[i++] = c;
  r.t = i;
  r.clamp();
}

// (protected) r = this * a, r != this,a (HAC 14.12)
// "this" should be the larger one if appropriate.
function bnpMultiplyTo(a, r) {
  var x = this.abs(),
    y = a.abs();
  var i = x.t;
  r.t = i + y.t;
  while (--i >= 0) r[i] = 0;
  for (i = 0; i < y.t; ++i) r[i + x.t] = x.am(0, y[i], r, i, 0, x.t);
  r.s = 0;
  r.clamp();
  if (this.s != a.s) BigInteger.ZERO.subTo(r, r);
}

// (protected) r = this^2, r != this (HAC 14.16)
function bnpSquareTo(r) {
  var x = this.abs();
  var i = r.t = 2 * x.t;
  while (--i >= 0) r[i] = 0;
  for (i = 0; i < x.t - 1; ++i) {
    var c = x.am(i, x[i], r, 2 * i, 0, 1);
    if ((r[i + x.t] += x.am(i + 1, 2 * x[i], r, 2 * i + 1, c, x.t - i - 1)) >= x.DV) {
      r[i + x.t] -= x.DV;
      r[i + x.t + 1] = 1;
    }
  }
  if (r.t > 0) r[r.t - 1] += x.am(i, x[i], r, 2 * i, 0, 1);
  r.s = 0;
  r.clamp();
}

// (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
// r != q, this != m.  q or r may be null.
function bnpDivRemTo(m, q, r) {
  var self = this;
  var pm = m.abs();
  if (pm.t <= 0) return;
  var pt = self.abs();
  if (pt.t < pm.t) {
    if (q != null) q.fromInt(0);
    if (r != null) self.copyTo(r);
    return;
  }
  if (r == null) r = nbi();
  var y = nbi(),
    ts = self.s,
    ms = m.s;
  var nsh = self.DB - nbits(pm[pm.t - 1]); // normalize modulus
  if (nsh > 0) {
    pm.lShiftTo(nsh, y);
    pt.lShiftTo(nsh, r);
  } else {
    pm.copyTo(y);
    pt.copyTo(r);
  }
  var ys = y.t;
  var y0 = y[ys - 1];
  if (y0 == 0) return;
  var yt = y0 * (1 << self.F1) + ((ys > 1) ? y[ys - 2] >> self.F2 : 0);
  var d1 = self.FV / yt,
    d2 = (1 << self.F1) / yt,
    e = 1 << self.F2;
  var i = r.t,
    j = i - ys,
    t = (q == null) ? nbi() : q;
  y.dlShiftTo(j, t);
  if (r.compareTo(t) >= 0) {
    r[r.t++] = 1;
    r.subTo(t, r);
  }
  BigInteger.ONE.dlShiftTo(ys, t);
  t.subTo(y, y); // "negative" y so we can replace sub with am later
  while (y.t < ys) y[y.t++] = 0;
  while (--j >= 0) {
    // Estimate quotient digit
    var qd = (r[--i] == y0) ? self.DM : Math.floor(r[i] * d1 + (r[i - 1] + e) * d2);
    if ((r[i] += y.am(0, qd, r, j, 0, ys)) < qd) { // Try it out
      y.dlShiftTo(j, t);
      r.subTo(t, r);
      while (r[i] < --qd) r.subTo(t, r);
    }
  }
  if (q != null) {
    r.drShiftTo(ys, q);
    if (ts != ms) BigInteger.ZERO.subTo(q, q);
  }
  r.t = ys;
  r.clamp();
  if (nsh > 0) r.rShiftTo(nsh, r); // Denormalize remainder
  if (ts < 0) BigInteger.ZERO.subTo(r, r);
}

// (public) this mod a
function bnMod(a) {
  var r = nbi();
  this.abs().divRemTo(a, null, r);
  if (this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r, r);
  return r;
}

// Modular reduction using "classic" algorithm
function Classic(m) {
  this.m = m;
}

function cConvert(x) {
  if (x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
  else return x;
}

function cRevert(x) {
  return x;
}

function cReduce(x) {
  x.divRemTo(this.m, null, x);
}

function cMulTo(x, y, r) {
  x.multiplyTo(y, r);
  this.reduce(r);
}

function cSqrTo(x, r) {
  x.squareTo(r);
  this.reduce(r);
}

Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;

// (protected) return "-1/this % 2^DB"; useful for Mont. reduction
// justification:
//         xy == 1 (mod m)
//         xy =  1+km
//   xy(2-xy) = (1+km)(1-km)
// x[y(2-xy)] = 1-k^2m^2
// x[y(2-xy)] == 1 (mod m^2)
// if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
// should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
// JS multiply "overflows" differently from C/C++, so care is needed here.
function bnpInvDigit() {
  if (this.t < 1) return 0;
  var x = this[0];
  if ((x & 1) == 0) return 0;
  var y = x & 3; // y == 1/x mod 2^2
  y = (y * (2 - (x & 0xf) * y)) & 0xf; // y == 1/x mod 2^4
  y = (y * (2 - (x & 0xff) * y)) & 0xff; // y == 1/x mod 2^8
  y = (y * (2 - (((x & 0xffff) * y) & 0xffff))) & 0xffff; // y == 1/x mod 2^16
  // last step - calculate inverse mod DV directly;
  // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
  y = (y * (2 - x * y % this.DV)) % this.DV; // y == 1/x mod 2^dbits
  // we really want the negative inverse, and -DV < y < DV
  return (y > 0) ? this.DV - y : -y;
}

// Montgomery reduction
function Montgomery(m) {
  this.m = m;
  this.mp = m.invDigit();
  this.mpl = this.mp & 0x7fff;
  this.mph = this.mp >> 15;
  this.um = (1 << (m.DB - 15)) - 1;
  this.mt2 = 2 * m.t;
}

// xR mod m
function montConvert(x) {
  var r = nbi();
  x.abs().dlShiftTo(this.m.t, r);
  r.divRemTo(this.m, null, r);
  if (x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r, r);
  return r;
}

// x/R mod m
function montRevert(x) {
  var r = nbi();
  x.copyTo(r);
  this.reduce(r);
  return r;
}

// x = x/R mod m (HAC 14.32)
function montReduce(x) {
  while (x.t <= this.mt2) // pad x so am has enough room later
    x[x.t++] = 0;
  for (var i = 0; i < this.m.t; ++i) {
    // faster way of calculating u0 = x[i]*mp mod DV
    var j = x[i] & 0x7fff;
    var u0 = (j * this.mpl + (((j * this.mph + (x[i] >> 15) * this.mpl) & this.um) << 15)) & x.DM;
    // use am to combine the multiply-shift-add into one call
    j = i + this.m.t;
    x[j] += this.m.am(0, u0, x, i, 0, this.m.t);
    // propagate carry
    while (x[j] >= x.DV) {
      x[j] -= x.DV;
      x[++j]++;
    }
  }
  x.clamp();
  x.drShiftTo(this.m.t, x);
  if (x.compareTo(this.m) >= 0) x.subTo(this.m, x);
}

// r = "x^2/R mod m"; x != r
function montSqrTo(x, r) {
  x.squareTo(r);
  this.reduce(r);
}

// r = "xy/R mod m"; x,y != r
function montMulTo(x, y, r) {
  x.multiplyTo(y, r);
  this.reduce(r);
}

Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;

// (protected) true iff this is even
function bnpIsEven() {
  return ((this.t > 0) ? (this[0] & 1) : this.s) == 0;
}

// (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
function bnpExp(e, z) {
  if (e > 0xffffffff || e < 1) return BigInteger.ONE;
  var r = nbi(),
    r2 = nbi(),
    g = z.convert(this),
    i = nbits(e) - 1;
  g.copyTo(r);
  while (--i >= 0) {
    z.sqrTo(r, r2);
    if ((e & (1 << i)) > 0) z.mulTo(r2, g, r);
    else {
      var t = r;
      r = r2;
      r2 = t;
    }
  }
  return z.revert(r);
}

// (public) this^e % m, 0 <= e < 2^32
function bnModPowInt(e, m) {
  var z;
  if (e < 256 || m.isEven()) z = new Classic(m);
  else z = new Montgomery(m);
  return this.exp(e, z);
}

// protected
proto.copyTo = bnpCopyTo;
proto.fromInt = bnpFromInt;
proto.fromString = bnpFromString;
proto.clamp = bnpClamp;
proto.dlShiftTo = bnpDLShiftTo;
proto.drShiftTo = bnpDRShiftTo;
proto.lShiftTo = bnpLShiftTo;
proto.rShiftTo = bnpRShiftTo;
proto.subTo = bnpSubTo;
proto.multiplyTo = bnpMultiplyTo;
proto.squareTo = bnpSquareTo;
proto.divRemTo = bnpDivRemTo;
proto.invDigit = bnpInvDigit;
proto.isEven = bnpIsEven;
proto.exp = bnpExp;

// public
proto.toString = bnToString;
proto.negate = bnNegate;
proto.abs = bnAbs;
proto.compareTo = bnCompareTo;
proto.bitLength = bnBitLength;
proto.mod = bnMod;
proto.modPowInt = bnModPowInt;

// (public)
function bnClone() {
  var r = nbi();
  this.copyTo(r);
  return r;
}

// (public) return value as integer
function bnIntValue() {
  if (this.s < 0) {
    if (this.t == 1) return this[0] - this.DV;
    else if (this.t == 0) return -1;
  } else if (this.t == 1) return this[0];
  else if (this.t == 0) return 0;
  // assumes 16 < DB < 32
  return ((this[1] & ((1 << (32 - this.DB)) - 1)) << this.DB) | this[0];
}

// (public) return value as byte
function bnByteValue() {
  return (this.t == 0) ? this.s : (this[0] << 24) >> 24;
}

// (public) return value as short (assumes DB>=16)
function bnShortValue() {
  return (this.t == 0) ? this.s : (this[0] << 16) >> 16;
}

// (protected) return x s.t. r^x < DV
function bnpChunkSize(r) {
  return Math.floor(Math.LN2 * this.DB / Math.log(r));
}

// (public) 0 if this == 0, 1 if this > 0
function bnSigNum() {
  if (this.s < 0) return -1;
  else if (this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0;
  else return 1;
}

// (protected) convert to radix string
function bnpToRadix(b) {
  if (b == null) b = 10;
  if (this.signum() == 0 || b < 2 || b > 36) return "0";
  var cs = this.chunkSize(b);
  var a = Math.pow(b, cs);
  var d = nbv(a),
    y = nbi(),
    z = nbi(),
    r = "";
  this.divRemTo(d, y, z);
  while (y.signum() > 0) {
    r = (a + z.intValue()).toString(b).substr(1) + r;
    y.divRemTo(d, y, z);
  }
  return z.intValue().toString(b) + r;
}

// (protected) convert from radix string
function bnpFromRadix(s, b) {
  var self = this;
  self.fromInt(0);
  if (b == null) b = 10;
  var cs = self.chunkSize(b);
  var d = Math.pow(b, cs),
    mi = false,
    j = 0,
    w = 0;
  for (var i = 0; i < s.length; ++i) {
    var x = intAt(s, i);
    if (x < 0) {
      if (s.charAt(i) == "-" && self.signum() == 0) mi = true;
      continue;
    }
    w = b * w + x;
    if (++j >= cs) {
      self.dMultiply(d);
      self.dAddOffset(w, 0);
      j = 0;
      w = 0;
    }
  }
  if (j > 0) {
    self.dMultiply(Math.pow(b, j));
    self.dAddOffset(w, 0);
  }
  if (mi) BigInteger.ZERO.subTo(self, self);
}

// (protected) alternate constructor
function bnpFromNumber(a, b, c) {
  var self = this;
  if ("number" == typeof b) {
    // new BigInteger(int,int,RNG)
    if (a < 2) self.fromInt(1);
    else {
      self.fromNumber(a, c);
      if (!self.testBit(a - 1)) // force MSB set
        self.bitwiseTo(BigInteger.ONE.shiftLeft(a - 1), op_or, self);
      if (self.isEven()) self.dAddOffset(1, 0); // force odd
      while (!self.isProbablePrime(b)) {
        self.dAddOffset(2, 0);
        if (self.bitLength() > a) self.subTo(BigInteger.ONE.shiftLeft(a - 1), self);
      }
    }
  } else {
    // new BigInteger(int,RNG)
    var x = new Array(),
      t = a & 7;
    x.length = (a >> 3) + 1;
    b.nextBytes(x);
    if (t > 0) x[0] &= ((1 << t) - 1);
    else x[0] = 0;
    self.fromString(x, 256);
  }
}

// (public) convert to bigendian byte array
function bnToByteArray() {
  var self = this;
  var i = self.t,
    r = new Array();
  r[0] = self.s;
  var p = self.DB - (i * self.DB) % 8,
    d, k = 0;
  if (i-- > 0) {
    if (p < self.DB && (d = self[i] >> p) != (self.s & self.DM) >> p)
      r[k++] = d | (self.s << (self.DB - p));
    while (i >= 0) {
      if (p < 8) {
        d = (self[i] & ((1 << p) - 1)) << (8 - p);
        d |= self[--i] >> (p += self.DB - 8);
      } else {
        d = (self[i] >> (p -= 8)) & 0xff;
        if (p <= 0) {
          p += self.DB;
          --i;
        }
      }
      if ((d & 0x80) != 0) d |= -256;
      if (k === 0 && (self.s & 0x80) != (d & 0x80)) ++k;
      if (k > 0 || d != self.s) r[k++] = d;
    }
  }
  return r;
}

function bnEquals(a) {
  return (this.compareTo(a) == 0);
}

function bnMin(a) {
  return (this.compareTo(a) < 0) ? this : a;
}

function bnMax(a) {
  return (this.compareTo(a) > 0) ? this : a;
}

// (protected) r = this op a (bitwise)
function bnpBitwiseTo(a, op, r) {
  var self = this;
  var i, f, m = Math.min(a.t, self.t);
  for (i = 0; i < m; ++i) r[i] = op(self[i], a[i]);
  if (a.t < self.t) {
    f = a.s & self.DM;
    for (i = m; i < self.t; ++i) r[i] = op(self[i], f);
    r.t = self.t;
  } else {
    f = self.s & self.DM;
    for (i = m; i < a.t; ++i) r[i] = op(f, a[i]);
    r.t = a.t;
  }
  r.s = op(self.s, a.s);
  r.clamp();
}

// (public) this & a
function op_and(x, y) {
  return x & y;
}

function bnAnd(a) {
  var r = nbi();
  this.bitwiseTo(a, op_and, r);
  return r;
}

// (public) this | a
function op_or(x, y) {
  return x | y;
}

function bnOr(a) {
  var r = nbi();
  this.bitwiseTo(a, op_or, r);
  return r;
}

// (public) this ^ a
function op_xor(x, y) {
  return x ^ y;
}

function bnXor(a) {
  var r = nbi();
  this.bitwiseTo(a, op_xor, r);
  return r;
}

// (public) this & ~a
function op_andnot(x, y) {
  return x & ~y;
}

function bnAndNot(a) {
  var r = nbi();
  this.bitwiseTo(a, op_andnot, r);
  return r;
}

// (public) ~this
function bnNot() {
  var r = nbi();
  for (var i = 0; i < this.t; ++i) r[i] = this.DM & ~this[i];
  r.t = this.t;
  r.s = ~this.s;
  return r;
}

// (public) this << n
function bnShiftLeft(n) {
  var r = nbi();
  if (n < 0) this.rShiftTo(-n, r);
  else this.lShiftTo(n, r);
  return r;
}

// (public) this >> n
function bnShiftRight(n) {
  var r = nbi();
  if (n < 0) this.lShiftTo(-n, r);
  else this.rShiftTo(n, r);
  return r;
}

// return index of lowest 1-bit in x, x < 2^31
function lbit(x) {
  if (x == 0) return -1;
  var r = 0;
  if ((x & 0xffff) == 0) {
    x >>= 16;
    r += 16;
  }
  if ((x & 0xff) == 0) {
    x >>= 8;
    r += 8;
  }
  if ((x & 0xf) == 0) {
    x >>= 4;
    r += 4;
  }
  if ((x & 3) == 0) {
    x >>= 2;
    r += 2;
  }
  if ((x & 1) == 0) ++r;
  return r;
}

// (public) returns index of lowest 1-bit (or -1 if none)
function bnGetLowestSetBit() {
  for (var i = 0; i < this.t; ++i)
    if (this[i] != 0) return i * this.DB + lbit(this[i]);
  if (this.s < 0) return this.t * this.DB;
  return -1;
}

// return number of 1 bits in x
function cbit(x) {
  var r = 0;
  while (x != 0) {
    x &= x - 1;
    ++r;
  }
  return r;
}

// (public) return number of set bits
function bnBitCount() {
  var r = 0,
    x = this.s & this.DM;
  for (var i = 0; i < this.t; ++i) r += cbit(this[i] ^ x);
  return r;
}

// (public) true iff nth bit is set
function bnTestBit(n) {
  var j = Math.floor(n / this.DB);
  if (j >= this.t) return (this.s != 0);
  return ((this[j] & (1 << (n % this.DB))) != 0);
}

// (protected) this op (1<<n)
function bnpChangeBit(n, op) {
  var r = BigInteger.ONE.shiftLeft(n);
  this.bitwiseTo(r, op, r);
  return r;
}

// (public) this | (1<<n)
function bnSetBit(n) {
  return this.changeBit(n, op_or);
}

// (public) this & ~(1<<n)
function bnClearBit(n) {
  return this.changeBit(n, op_andnot);
}

// (public) this ^ (1<<n)
function bnFlipBit(n) {
  return this.changeBit(n, op_xor);
}

// (protected) r = this + a
function bnpAddTo(a, r) {
  var self = this;

  var i = 0,
    c = 0,
    m = Math.min(a.t, self.t);
  while (i < m) {
    c += self[i] + a[i];
    r[i++] = c & self.DM;
    c >>= self.DB;
  }
  if (a.t < self.t) {
    c += a.s;
    while (i < self.t) {
      c += self[i];
      r[i++] = c & self.DM;
      c >>= self.DB;
    }
    c += self.s;
  } else {
    c += self.s;
    while (i < a.t) {
      c += a[i];
      r[i++] = c & self.DM;
      c >>= self.DB;
    }
    c += a.s;
  }
  r.s = (c < 0) ? -1 : 0;
  if (c > 0) r[i++] = c;
  else if (c < -1) r[i++] = self.DV + c;
  r.t = i;
  r.clamp();
}

// (public) this + a
function bnAdd(a) {
  var r = nbi();
  this.addTo(a, r);
  return r;
}

// (public) this - a
function bnSubtract(a) {
  var r = nbi();
  this.subTo(a, r);
  return r;
}

// (public) this * a
function bnMultiply(a) {
  var r = nbi();
  this.multiplyTo(a, r);
  return r;
}

// (public) this^2
function bnSquare() {
  var r = nbi();
  this.squareTo(r);
  return r;
}

// (public) this / a
function bnDivide(a) {
  var r = nbi();
  this.divRemTo(a, r, null);
  return r;
}

// (public) this % a
function bnRemainder(a) {
  var r = nbi();
  this.divRemTo(a, null, r);
  return r;
}

// (public) [this/a,this%a]
function bnDivideAndRemainder(a) {
  var q = nbi(),
    r = nbi();
  this.divRemTo(a, q, r);
  return new Array(q, r);
}

// (protected) this *= n, this >= 0, 1 < n < DV
function bnpDMultiply(n) {
  this[this.t] = this.am(0, n - 1, this, 0, 0, this.t);
  ++this.t;
  this.clamp();
}

// (protected) this += n << w words, this >= 0
function bnpDAddOffset(n, w) {
  if (n == 0) return;
  while (this.t <= w) this[this.t++] = 0;
  this[w] += n;
  while (this[w] >= this.DV) {
    this[w] -= this.DV;
    if (++w >= this.t) this[this.t++] = 0;
    ++this[w];
  }
}

// A "null" reducer
function NullExp() {}

function nNop(x) {
  return x;
}

function nMulTo(x, y, r) {
  x.multiplyTo(y, r);
}

function nSqrTo(x, r) {
  x.squareTo(r);
}

NullExp.prototype.convert = nNop;
NullExp.prototype.revert = nNop;
NullExp.prototype.mulTo = nMulTo;
NullExp.prototype.sqrTo = nSqrTo;

// (public) this^e
function bnPow(e) {
  return this.exp(e, new NullExp());
}

// (protected) r = lower n words of "this * a", a.t <= n
// "this" should be the larger one if appropriate.
function bnpMultiplyLowerTo(a, n, r) {
  var i = Math.min(this.t + a.t, n);
  r.s = 0; // assumes a,this >= 0
  r.t = i;
  while (i > 0) r[--i] = 0;
  var j;
  for (j = r.t - this.t; i < j; ++i) r[i + this.t] = this.am(0, a[i], r, i, 0, this.t);
  for (j = Math.min(a.t, n); i < j; ++i) this.am(0, a[i], r, i, 0, n - i);
  r.clamp();
}

// (protected) r = "this * a" without lower n words, n > 0
// "this" should be the larger one if appropriate.
function bnpMultiplyUpperTo(a, n, r) {
  --n;
  var i = r.t = this.t + a.t - n;
  r.s = 0; // assumes a,this >= 0
  while (--i >= 0) r[i] = 0;
  for (i = Math.max(n - this.t, 0); i < a.t; ++i)
    r[this.t + i - n] = this.am(n - i, a[i], r, 0, 0, this.t + i - n);
  r.clamp();
  r.drShiftTo(1, r);
}

// Barrett modular reduction
function Barrett(m) {
  // setup Barrett
  this.r2 = nbi();
  this.q3 = nbi();
  BigInteger.ONE.dlShiftTo(2 * m.t, this.r2);
  this.mu = this.r2.divide(m);
  this.m = m;
}

function barrettConvert(x) {
  if (x.s < 0 || x.t > 2 * this.m.t) return x.mod(this.m);
  else if (x.compareTo(this.m) < 0) return x;
  else {
    var r = nbi();
    x.copyTo(r);
    this.reduce(r);
    return r;
  }
}

function barrettRevert(x) {
  return x;
}

// x = x mod m (HAC 14.42)
function barrettReduce(x) {
  var self = this;
  x.drShiftTo(self.m.t - 1, self.r2);
  if (x.t > self.m.t + 1) {
    x.t = self.m.t + 1;
    x.clamp();
  }
  self.mu.multiplyUpperTo(self.r2, self.m.t + 1, self.q3);
  self.m.multiplyLowerTo(self.q3, self.m.t + 1, self.r2);
  while (x.compareTo(self.r2) < 0) x.dAddOffset(1, self.m.t + 1);
  x.subTo(self.r2, x);
  while (x.compareTo(self.m) >= 0) x.subTo(self.m, x);
}

// r = x^2 mod m; x != r
function barrettSqrTo(x, r) {
  x.squareTo(r);
  this.reduce(r);
}

// r = x*y mod m; x,y != r
function barrettMulTo(x, y, r) {
  x.multiplyTo(y, r);
  this.reduce(r);
}

Barrett.prototype.convert = barrettConvert;
Barrett.prototype.revert = barrettRevert;
Barrett.prototype.reduce = barrettReduce;
Barrett.prototype.mulTo = barrettMulTo;
Barrett.prototype.sqrTo = barrettSqrTo;

// (public) this^e % m (HAC 14.85)
function bnModPow(e, m) {
  var i = e.bitLength(),
    k, r = nbv(1),
    z;
  if (i <= 0) return r;
  else if (i < 18) k = 1;
  else if (i < 48) k = 3;
  else if (i < 144) k = 4;
  else if (i < 768) k = 5;
  else k = 6;
  if (i < 8)
    z = new Classic(m);
  else if (m.isEven())
    z = new Barrett(m);
  else
    z = new Montgomery(m);

  // precomputation
  var g = new Array(),
    n = 3,
    k1 = k - 1,
    km = (1 << k) - 1;
  g[1] = z.convert(this);
  if (k > 1) {
    var g2 = nbi();
    z.sqrTo(g[1], g2);
    while (n <= km) {
      g[n] = nbi();
      z.mulTo(g2, g[n - 2], g[n]);
      n += 2;
    }
  }

  var j = e.t - 1,
    w, is1 = true,
    r2 = nbi(),
    t;
  i = nbits(e[j]) - 1;
  while (j >= 0) {
    if (i >= k1) w = (e[j] >> (i - k1)) & km;
    else {
      w = (e[j] & ((1 << (i + 1)) - 1)) << (k1 - i);
      if (j > 0) w |= e[j - 1] >> (this.DB + i - k1);
    }

    n = k;
    while ((w & 1) == 0) {
      w >>= 1;
      --n;
    }
    if ((i -= n) < 0) {
      i += this.DB;
      --j;
    }
    if (is1) { // ret == 1, don't bother squaring or multiplying it
      g[w].copyTo(r);
      is1 = false;
    } else {
      while (n > 1) {
        z.sqrTo(r, r2);
        z.sqrTo(r2, r);
        n -= 2;
      }
      if (n > 0) z.sqrTo(r, r2);
      else {
        t = r;
        r = r2;
        r2 = t;
      }
      z.mulTo(r2, g[w], r);
    }

    while (j >= 0 && (e[j] & (1 << i)) == 0) {
      z.sqrTo(r, r2);
      t = r;
      r = r2;
      r2 = t;
      if (--i < 0) {
        i = this.DB - 1;
        --j;
      }
    }
  }
  return z.revert(r);
}

// (public) gcd(this,a) (HAC 14.54)
function bnGCD(a) {
  var x = (this.s < 0) ? this.negate() : this.clone();
  var y = (a.s < 0) ? a.negate() : a.clone();
  if (x.compareTo(y) < 0) {
    var t = x;
    x = y;
    y = t;
  }
  var i = x.getLowestSetBit(),
    g = y.getLowestSetBit();
  if (g < 0) return x;
  if (i < g) g = i;
  if (g > 0) {
    x.rShiftTo(g, x);
    y.rShiftTo(g, y);
  }
  while (x.signum() > 0) {
    if ((i = x.getLowestSetBit()) > 0) x.rShiftTo(i, x);
    if ((i = y.getLowestSetBit()) > 0) y.rShiftTo(i, y);
    if (x.compareTo(y) >= 0) {
      x.subTo(y, x);
      x.rShiftTo(1, x);
    } else {
      y.subTo(x, y);
      y.rShiftTo(1, y);
    }
  }
  if (g > 0) y.lShiftTo(g, y);
  return y;
}

// (protected) this % n, n < 2^26
function bnpModInt(n) {
  if (n <= 0) return 0;
  var d = this.DV % n,
    r = (this.s < 0) ? n - 1 : 0;
  if (this.t > 0)
    if (d == 0) r = this[0] % n;
    else
      for (var i = this.t - 1; i >= 0; --i) r = (d * r + this[i]) % n;
  return r;
}

// (public) 1/this % m (HAC 14.61)
function bnModInverse(m) {
  var ac = m.isEven();
  if ((this.isEven() && ac) || m.signum() == 0) return BigInteger.ZERO;
  var u = m.clone(),
    v = this.clone();
  var a = nbv(1),
    b = nbv(0),
    c = nbv(0),
    d = nbv(1);
  while (u.signum() != 0) {
    while (u.isEven()) {
      u.rShiftTo(1, u);
      if (ac) {
        if (!a.isEven() || !b.isEven()) {
          a.addTo(this, a);
          b.subTo(m, b);
        }
        a.rShiftTo(1, a);
      } else if (!b.isEven()) b.subTo(m, b);
      b.rShiftTo(1, b);
    }
    while (v.isEven()) {
      v.rShiftTo(1, v);
      if (ac) {
        if (!c.isEven() || !d.isEven()) {
          c.addTo(this, c);
          d.subTo(m, d);
        }
        c.rShiftTo(1, c);
      } else if (!d.isEven()) d.subTo(m, d);
      d.rShiftTo(1, d);
    }
    if (u.compareTo(v) >= 0) {
      u.subTo(v, u);
      if (ac) a.subTo(c, a);
      b.subTo(d, b);
    } else {
      v.subTo(u, v);
      if (ac) c.subTo(a, c);
      d.subTo(b, d);
    }
  }
  if (v.compareTo(BigInteger.ONE) != 0) return BigInteger.ZERO;
  if (d.compareTo(m) >= 0) return d.subtract(m);
  if (d.signum() < 0) d.addTo(m, d);
  else return d;
  if (d.signum() < 0) return d.add(m);
  else return d;
}

// protected
proto.chunkSize = bnpChunkSize;
proto.toRadix = bnpToRadix;
proto.fromRadix = bnpFromRadix;
proto.fromNumber = bnpFromNumber;
proto.bitwiseTo = bnpBitwiseTo;
proto.changeBit = bnpChangeBit;
proto.addTo = bnpAddTo;
proto.dMultiply = bnpDMultiply;
proto.dAddOffset = bnpDAddOffset;
proto.multiplyLowerTo = bnpMultiplyLowerTo;
proto.multiplyUpperTo = bnpMultiplyUpperTo;
proto.modInt = bnpModInt;

// public
proto.clone = bnClone;
proto.intValue = bnIntValue;
proto.byteValue = bnByteValue;
proto.shortValue = bnShortValue;
proto.signum = bnSigNum;
proto.toByteArray = bnToByteArray;
proto.equals = bnEquals;
proto.min = bnMin;
proto.max = bnMax;
proto.and = bnAnd;
proto.or = bnOr;
proto.xor = bnXor;
proto.andNot = bnAndNot;
proto.not = bnNot;
proto.shiftLeft = bnShiftLeft;
proto.shiftRight = bnShiftRight;
proto.getLowestSetBit = bnGetLowestSetBit;
proto.bitCount = bnBitCount;
proto.testBit = bnTestBit;
proto.setBit = bnSetBit;
proto.clearBit = bnClearBit;
proto.flipBit = bnFlipBit;
proto.add = bnAdd;
proto.subtract = bnSubtract;
proto.multiply = bnMultiply;
proto.divide = bnDivide;
proto.remainder = bnRemainder;
proto.divideAndRemainder = bnDivideAndRemainder;
proto.modPow = bnModPow;
proto.modInverse = bnModInverse;
proto.pow = bnPow;
proto.gcd = bnGCD;

// JSBN-specific extension
proto.square = bnSquare;

// BigInteger interfaces not implemented in jsbn:

// BigInteger(int signum, byte[] magnitude)
// double doubleValue()
// float floatValue()
// int hashCode()
// long longValue()
// static BigInteger valueOf(long val)

// "constants"
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);
BigInteger.valueOf = nbv;


/// bitcoinjs addons

/**
 * Turns a byte array into a big integer.
 *
 * This function will interpret a byte array as a big integer in big
 * endian notation and ignore leading zeros.
 */
BigInteger.fromByteArrayUnsigned = function(ba) {

  if (!ba.length) {
    return new BigInteger.valueOf(0);
  } else if (ba[0] & 0x80) {
    // Prepend a zero so the BigInteger class doesn't mistake this
    // for a negative integer.
    return new BigInteger([0].concat(ba));
  } else {
    return new BigInteger(ba);
  }
};

/**
 * Parse a signed big integer byte representation.
 *
 * For details on the format please see BigInteger.toByteArraySigned.
 */
BigInteger.fromByteArraySigned = function(ba) {
  // Check for negative value
  if (ba[0] & 0x80) {
    // Remove sign bit
    ba[0] &= 0x7f;

    return BigInteger.fromByteArrayUnsigned(ba).negate();
  } else {
    return BigInteger.fromByteArrayUnsigned(ba);
  }
};

/**
 * Returns a byte array representation of the big integer.
 *
 * This returns the absolute of the contained value in big endian
 * form. A value of zero results in an empty array.
 */
BigInteger.prototype.toByteArrayUnsigned = function() {
  var ba = this.abs().toByteArray();

  // Empty array, nothing to do
  if (!ba.length) {
    return ba;
  }

  // remove leading 0
  if (ba[0] === 0) {
    ba = ba.slice(1);
  }

  // all values must be positive
  for (var i = 0; i < ba.length; ++i) {
    ba[i] = (ba[i] < 0) ? ba[i] + 256 : ba[i];
  }

  return ba;
};

/*
 * Converts big integer to signed byte representation.
 *
 * The format for this value uses the most significant bit as a sign
 * bit. If the most significant bit is already occupied by the
 * absolute value, an extra byte is prepended and the sign bit is set
 * there.
 *
 * Examples:
 *
 *      0 =>     0x00
 *      1 =>     0x01
 *     -1 =>     0x81
 *    127 =>     0x7f
 *   -127 =>     0xff
 *    128 =>   0x0080
 *   -128 =>   0x8080
 *    255 =>   0x00ff
 *   -255 =>   0x80ff
 *  16300 =>   0x3fac
 * -16300 =>   0xbfac
 *  62300 => 0x00f35c
 * -62300 => 0x80f35c
 */
BigInteger.prototype.toByteArraySigned = function() {
  var val = this.toByteArrayUnsigned();
  var neg = this.s < 0;

  // if the first bit is set, we always unshift
  // either unshift 0x80 or 0x00
  if (val[0] & 0x80) {
    val.unshift((neg) ? 0x80 : 0x00);
  }
  // if the first bit isn't set, set it if negative
  else if (neg) {
    val[0] |= 0x80;
  }

  return val;
};







var coinjs = function() {};

/* public vars */
coinjs.pub = 0x00;
coinjs.priv = 0x80;
coinjs.multisig = 0x05;
coinjs.hdkey = {
  'prv': 0x0488ade4,
  'pub': 0x0488b21e
};
coinjs.bech32 = {
  'charset': 'qpzry9x8gf2tvdw0s3jn54khce6mua7l',
  'version': 0,
  'hrp': 'bc'
};

coinjs.setToTestnet = () => {
  coinjs.pub = 111;
  coinjs.priv = 239;
  coinjs.multisig = 196;
  coinjs.hdkey.pub = 70617039;
  coinjs.hdkey.prv = 70615956;
  coinjs.bech32.hrp = 'bc';
  coinjs.coinType = 'BTC';
}

coinjs.setToLTC = () => {
  coinjs.pub = 48;
  coinjs.priv = 176;
  coinjs.multisig = 50;
  coinjs.hdkey.pub = 27106558;
  coinjs.hdkey.prv = 27108450;
  coinjs.bech32.hrp = 'ltc';
  coinjs.coinType = 'LTC';
}

coinjs.compressed = false;

/* other vars */
coinjs.developer = '3K1oFZMks41C7qDYBsr72SYjapLqDuSYuN'; //bitcoin

/* bit(coinb.in) api vars */
coinjs.uid = '1';
coinjs.key = '12345678901234567890123456789012';

/* start of address functions */

/* generate a private and public keypair, with address and WIF address */
coinjs.newKeys = function(input) {
  var privkey = (input) ? Crypto.SHA256(input) : this.newPrivkey();
  var pubkey = this.newPubkey(privkey);
  return {
    'privkey': privkey,
    'pubkey': pubkey,
    'address': this.pubkey2address(pubkey),
    'wif': this.privkey2wif(privkey),
    'compressed': this.compressed
  };
}

/* generate a new random private key */
coinjs.newPrivkey = function() {
  let x = this.random(64);
  x += this.random(64);
  x += this.random(64);
  x += 'nibiru';
  x += randomBytes.sync(64).join('');

  const dateObj = new Date();
  x += dateObj.getTimezoneOffset();
  x += this.random(64);
  x += x + '' + x;

  var r = x;
  for (let i = 0; i < (x).length / 25; i++) {
    r = Crypto.SHA256(r.concat(x));
  }
  var checkrBigInt = new BigInteger(r);
  var orderBigInt = new BigInteger("fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
  while (checkrBigInt.compareTo(orderBigInt) >= 0 || checkrBigInt.equals(BigInteger.ZERO) || checkrBigInt.equals(BigInteger.ONE)) {
    r = Crypto.SHA256(r.concat(x));
    checkrBigInt = new BigInteger(r);
  }
  return r;
}

/* generate a public key from a private key */
coinjs.newPubkey = function(hash) {
  var privateKeyBigInt = BigInteger.fromByteArrayUnsigned(Crypto.util.hexToBytes(hash));
  var curve = EllipticCurve.getSECCurveByName("secp256k1");

  var curvePt = curve.getG().multiply(privateKeyBigInt);
  var x = curvePt.getX().toBigInteger();
  var y = curvePt.getY().toBigInteger();

  var publicKeyBytes = EllipticCurve.integerToBytes(x, 32);
  publicKeyBytes = publicKeyBytes.concat(EllipticCurve.integerToBytes(y, 32));
  publicKeyBytes.unshift(0x04);

  if (coinjs.compressed == true) {
    var publicKeyBytesCompressed = EllipticCurve.integerToBytes(x, 32)
    if (y.isEven()) {
      publicKeyBytesCompressed.unshift(0x02)
    } else {
      publicKeyBytesCompressed.unshift(0x03)
    }
    return Crypto.util.bytesToHex(publicKeyBytesCompressed);
  } else {
    return Crypto.util.bytesToHex(publicKeyBytes);
  }
}

/* provide a public key and return address */
coinjs.pubkey2address = function(h, byte) {
  var r = ripemd160(Crypto.SHA256(Crypto.util.hexToBytes(h), {
    asBytes: true
  }));
  r.unshift(byte || coinjs.pub);
  var hash = Crypto.SHA256(Crypto.SHA256(r, {
    asBytes: true
  }), {
    asBytes: true
  });
  var checksum = hash.slice(0, 4);
  return coinjs.base58encode(r.concat(checksum));
}

/* provide a scripthash and return address */
coinjs.scripthash2address = function(h) {
  var x = Crypto.util.hexToBytes(h);
  x.unshift(coinjs.pub);
  var r = x;
  r = Crypto.SHA256(Crypto.SHA256(r, {
    asBytes: true
  }), {
    asBytes: true
  });
  var checksum = r.slice(0, 4);
  return coinjs.base58encode(x.concat(checksum));
}

/* new multisig address, provide the pubkeys AND required signatures to release the funds */
coinjs.pubkeys2MultisigAddress = function(pubkeys, required) {
  var s = coinjs.script();
  s.writeOp(81 + (required * 1) - 1); //OP_1
  for (var i = 0; i < pubkeys.length; ++i) {
    s.writeBytes(Crypto.util.hexToBytes(pubkeys[i]));
  }
  s.writeOp(81 + pubkeys.length - 1); //OP_1
  s.writeOp(174); //OP_CHECKMULTISIG
  var x = ripemd160(Crypto.SHA256(s.buffer, {
    asBytes: true
  }), {
    asBytes: true
  });
  x.unshift(coinjs.multisig);
  var r = x;
  r = Crypto.SHA256(Crypto.SHA256(r, {
    asBytes: true
  }), {
    asBytes: true
  });
  var checksum = r.slice(0, 4);
  var redeemScript = Crypto.util.bytesToHex(s.buffer);
  var address = coinjs.base58encode(x.concat(checksum));

  if (s.buffer.length > 520) { // too large
    address = 'invalid';
    redeemScript = 'invalid';
  }

  return {
    'address': address,
    'redeemScript': redeemScript,
    'size': s.buffer.length
  };
}

/* new time locked address, provide the pubkey and time necessary to unlock the funds.
    when time is greater than 500000000, it should be a unix timestamp (seconds since epoch),
    otherwise it should be the block height required before this transaction can be released.

    may throw a string on failure!
*/
coinjs.simpleHodlAddress = function(pubkey, checklocktimeverify) {

  if (checklocktimeverify < 0) {
    throw "Parameter for OP_CHECKLOCKTIMEVERIFY is negative.";
  }

  var s = coinjs.script();
  s.writeBytes(coinjs.numToByteArray(checklocktimeverify));
  s.writeOp(177); //OP_CHECKLOCKTIMEVERIFY
  s.writeOp(117); //OP_DROP
  s.writeBytes(Crypto.util.hexToBytes(pubkey));
  s.writeOp(172); //OP_CHECKSIG

  var x = ripemd160(Crypto.SHA256(s.buffer, {
    asBytes: true
  }), {
    asBytes: true
  });
  x.unshift(coinjs.multisig);
  var r = x;
  r = Crypto.SHA256(Crypto.SHA256(r, {
    asBytes: true
  }), {
    asBytes: true
  });
  var checksum = r.slice(0, 4);
  var redeemScript = Crypto.util.bytesToHex(s.buffer);
  var address = coinjs.base58encode(x.concat(checksum));

  return {
    'address': address,
    'redeemScript': redeemScript
  };
}

/* create a new segwit address */
coinjs.BitcoinAddress = function(pubkey) {
  var keyhash = [0x00, 0x14].concat(ripemd160(Crypto.SHA256(Crypto.util.hexToBytes(pubkey), {
    asBytes: true
  }), {
    asBytes: true
  }));
  var x = ripemd160(Crypto.SHA256(keyhash, {
    asBytes: true
  }), {
    asBytes: true
  });
  x.unshift(coinjs.multisig);
  var r = x;
  r = Crypto.SHA256(Crypto.SHA256(r, {
    asBytes: true
  }), {
    asBytes: true
  });
  var checksum = r.slice(0, 4);
  var address = coinjs.base58encode(x.concat(checksum));

  return {
    'address': address,
    'type': 'segwit',
    'redeemscript': Crypto.util.bytesToHex(keyhash)
  };
}

/* create a new segwit bech32 encoded address */
coinjs.bech32Address = function(pubkey) {
  var program = ripemd160(Crypto.SHA256(Crypto.util.hexToBytes(pubkey), {
    asBytes: true
  }), {
    asBytes: true
  });
  var address = coinjs.bech32_encode(coinjs.bech32.hrp, [coinjs.bech32.version].concat(coinjs.bech32_convert(program, 8, 5, true)));
  return {
    'address': address,
    'type': 'bech32',
    'redeemscript': Crypto.util.bytesToHex(program)
  };
}

/* extract the redeemscript from a bech32 address */
coinjs.bech32redeemscript = function(address) {
  var r = false;
  var decode = coinjs.bech32_decode(address);
  if (decode) {
    decode.data.shift();
    return Crypto.util.bytesToHex(coinjs.bech32_convert(decode.data, 5, 8, true));
  }
  return r;
}

/* provide a privkey and return an WIF  */
coinjs.privkey2wif = function(h) {
  var r = Crypto.util.hexToBytes(h);

  if (coinjs.compressed == true) {
    r.push(0x01);
  }

  r.unshift(coinjs.priv);
  var hash = Crypto.SHA256(Crypto.SHA256(r, {
    asBytes: true
  }), {
    asBytes: true
  });
  var checksum = hash.slice(0, 4);

  return coinjs.base58encode(r.concat(checksum));
}

/* convert a wif key back to a private key */
coinjs.wif2privkey = function(wif) {
  var compressed = false;
  var decode = coinjs.base58decode(wif);
  var key = decode.slice(0, decode.length - 4);
  key = key.slice(1, key.length);
  if (key.length >= 33 && key[key.length - 1] == 0x01) {
    key = key.slice(0, key.length - 1);
    compressed = true;
  }
  return {
    'privkey': Crypto.util.bytesToHex(key),
    'compressed': compressed
  };
}

/* convert a wif to a pubkey */
coinjs.wif2pubkey = function(wif) {
  var compressed = coinjs.compressed;
  var r = coinjs.wif2privkey(wif);
  coinjs.compressed = r['compressed'];
  var pubkey = coinjs.newPubkey(r['privkey']);
  coinjs.compressed = compressed;
  return {
    'pubkey': pubkey,
    'compressed': r['compressed']
  };
}

/* convert a wif to a address */
coinjs.wif2address = function(wif) {
  var r = coinjs.wif2pubkey(wif);
  return {
    'address': coinjs.pubkey2address(r['pubkey']),
    'compressed': r['compressed']
  };
}

/* decode or validate an address and return the hash */
coinjs.addressDecode = function(addr) {
  try {
    var bytes = coinjs.base58decode(addr);
    var front = bytes.slice(0, bytes.length - 4);
    var back = bytes.slice(bytes.length - 4);
    var checksum = Crypto.SHA256(Crypto.SHA256(front, {
      asBytes: true
    }), {
      asBytes: true
    }).slice(0, 4);
    if (checksum + "" == back + "") {

      var o = {};
      o.bytes = front.slice(1);
      o.version = front[0];

      if (o.version == coinjs.pub) { // standard address
        o.type = 'standard';

      } else if (o.version == coinjs.multisig) { // multisig address
        o.type = 'multisig';

      } else if (o.version == coinjs.priv) { // wifkey
        o.type = 'wifkey';

      } else if (o.version == 42) { // stealth address
        o.type = 'stealth';

        o.option = front[1];
        if (o.option != 0) {
          alert("Stealth Address option other than 0 is currently not supported!");
          return false;
        };

        o.scankey = Crypto.util.bytesToHex(front.slice(2, 35));
        o.n = front[35];

        if (o.n > 1) {
          alert("Stealth Multisig is currently not supported!");
          return false;
        };

        o.spendkey = Crypto.util.bytesToHex(front.slice(36, 69));
        o.m = front[69];
        o.prefixlen = front[70];

        if (o.prefixlen > 0) {
          alert("Stealth Address Prefixes are currently not supported!");
          return false;
        };
        o.prefix = front.slice(71);

      } else { // everything else
        o.type = 'other'; // address is still valid but unknown version
      }

      return o;
    } else {
      return false;
    }
  } catch (e) {
    let bech32rs = coinjs.bech32redeemscript(addr);
    if (bech32rs) {
      return {
        'type': 'bech32',
        'redeemscript': bech32rs
      };
    } else {
      return false;
    }
  }
}

/* retreive the balance from a given address */
coinjs.addressBalance = function(address, callback) {
  coinjs.ajax(coinjs.host + '?uid=' + coinjs.uid + '&key=' + coinjs.key + '&setmodule=addresses&request=bal&address=' + address + '&r=' + Math.random(), callback, "GET");
}

/* decompress an compressed public key */
coinjs.pubkeydecompress = function(pubkey) {
  if ((typeof(pubkey) == 'string') && pubkey.match(/^[a-f0-9]+$/i)) {
    var curve = EllipticCurve.getSECCurveByName("secp256k1");
    try {
      var pt = curve.curve.decodePointHex(pubkey);
      var x = pt.getX().toBigInteger();
      var y = pt.getY().toBigInteger();

      var publicKeyBytes = EllipticCurve.integerToBytes(x, 32);
      publicKeyBytes = publicKeyBytes.concat(EllipticCurve.integerToBytes(y, 32));
      publicKeyBytes.unshift(0x04);
      return Crypto.util.bytesToHex(publicKeyBytes);
    } catch (e) {
      // console.log(e);
      return false;
    }
  }
  return false;
}

coinjs.bech32_polymod = function(values) {
  var chk = 1;
  var BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  for (var p = 0; p < values.length; ++p) {
    var top = chk >> 25;
    chk = (chk & 0x1ffffff) << 5 ^ values[p];
    for (var i = 0; i < 5; ++i) {
      if ((top >> i) & 1) {
        chk ^= BECH32_GENERATOR[i];
      }
    }
  }
  return chk;
}

coinjs.bech32_hrpExpand = function(hrp) {
  var ret = [];
  var p;
  for (p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) >> 5);
  }
  ret.push(0);
  for (p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) & 31);
  }
  return ret;
}

coinjs.bech32_verifyChecksum = function(hrp, data) {
  return coinjs.bech32_polymod(coinjs.bech32_hrpExpand(hrp).concat(data)) === 1;
}

coinjs.bech32_createChecksum = function(hrp, data) {
  var values = coinjs.bech32_hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  var mod = coinjs.bech32_polymod(values) ^ 1;
  var ret = [];
  for (var p = 0; p < 6; ++p) {
    ret.push((mod >> 5 * (5 - p)) & 31);
  }
  return ret;
}

coinjs.bech32_encode = function(hrp, data) {
  var combined = data.concat(coinjs.bech32_createChecksum(hrp, data));
  var ret = hrp + '1';
  for (var p = 0; p < combined.length; ++p) {
    ret += coinjs.bech32.charset.charAt(combined[p]);
  }
  return ret;
}

coinjs.bech32_decode = function(bechString) {
  var p;
  var has_lower = false;
  var has_upper = false;
  for (p = 0; p < bechString.length; ++p) {
    if (bechString.charCodeAt(p) < 33 || bechString.charCodeAt(p) > 126) {
      return null;
    }
    if (bechString.charCodeAt(p) >= 97 && bechString.charCodeAt(p) <= 122) {
      has_lower = true;
    }
    if (bechString.charCodeAt(p) >= 65 && bechString.charCodeAt(p) <= 90) {
      has_upper = true;
    }
  }
  if (has_lower && has_upper) {
    return null;
  }
  bechString = bechString.toLowerCase();
  var pos = bechString.lastIndexOf('1');
  if (pos < 1 || pos + 7 > bechString.length || bechString.length > 90) {
    return null;
  }
  var hrp = bechString.substring(0, pos);
  var data = [];
  for (p = pos + 1; p < bechString.length; ++p) {
    var d = coinjs.bech32.charset.indexOf(bechString.charAt(p));
    if (d === -1) {
      return null;
    }
    data.push(d);
  }
  if (!coinjs.bech32_verifyChecksum(hrp, data)) {
    return null;
  }
  return {
    hrp: hrp,
    data: data.slice(0, data.length - 6)
  };
}

coinjs.bech32_convert = function(data, inBits, outBits, pad) {
  var value = 0;
  var bits = 0;
  var maxV = (1 << outBits) - 1;

  var result = [];
  for (var i = 0; i < data.length; ++i) {
    value = (value << inBits) | data[i];
    bits += inBits;

    while (bits >= outBits) {
      bits -= outBits;
      result.push((value >> bits) & maxV);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((value << (outBits - bits)) & maxV);
    }
  } else {
    if (bits >= inBits) throw new Error('Excess padding');
    if ((value << (outBits - bits)) & maxV) throw new Error('Non-zero padding');
  }

  return result;
}

coinjs.testdeterministicK = function() {
  // https://github.com/bitpay/bitcore/blob/9a5193d8e94b0bd5b8e7f00038e7c0b935405a03/test/crypto/ecdsa.js
  // Line 21 and 22 specify digest hash and privkey for the first 2 test vectors.
  // Line 96-117 tells expected result.

  var tx = coinjs.transaction();

  var test_vectors = [{
      'message': 'test data',
      'privkey': 'fee0a1f7afebf9d2a5a80c0c98a31c709681cce195cbcd06342b517970c0be1e',
      'k_bad00': 'fcce1de7a9bcd6b2d3defade6afa1913fb9229e3b7ddf4749b55c4848b2a196e',
      'k_bad01': '727fbcb59eb48b1d7d46f95a04991fc512eb9dbf9105628e3aec87428df28fd8',
      'k_bad15': '398f0e2c9f79728f7b3d84d447ac3a86d8b2083c8f234a0ffa9c4043d68bd258'
    },
    {
      'message': 'Everything should be made as simple as possible, but not simpler.',
      'privkey': '0000000000000000000000000000000000000000000000000000000000000001',
      'k_bad00': 'ec633bd56a5774a0940cb97e27a9e4e51dc94af737596a0c5cbb3d30332d92a5',
      'k_bad01': 'df55b6d1b5c48184622b0ead41a0e02bfa5ac3ebdb4c34701454e80aabf36f56',
      'k_bad15': 'def007a9a3c2f7c769c75da9d47f2af84075af95cadd1407393dc1e26086ef87'
    },
    {
      'message': 'Satoshi Nakamoto',
      'privkey': '0000000000000000000000000000000000000000000000000000000000000002',
      'k_bad00': 'd3edc1b8224e953f6ee05c8bbf7ae228f461030e47caf97cde91430b4607405e',
      'k_bad01': 'f86d8e43c09a6a83953f0ab6d0af59fb7446b4660119902e9967067596b58374',
      'k_bad15': '241d1f57d6cfd2f73b1ada7907b199951f95ef5ad362b13aed84009656e0254a'
    },
    {
      'message': 'Diffie Hellman',
      'privkey': '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
      'k_bad00': 'c378a41cb17dce12340788dd3503635f54f894c306d52f6e9bc4b8f18d27afcc',
      'k_bad01': '90756c96fef41152ac9abe08819c4e95f16da2af472880192c69a2b7bac29114',
      'k_bad15': '7b3f53300ab0ccd0f698f4d67db87c44cf3e9e513d9df61137256652b2e94e7c'
    },
    {
      'message': 'Japan',
      'privkey': '8080808080808080808080808080808080808080808080808080808080808080',
      'k_bad00': 'f471e61b51d2d8db78f3dae19d973616f57cdc54caaa81c269394b8c34edcf59',
      'k_bad01': '6819d85b9730acc876fdf59e162bf309e9f63dd35550edf20869d23c2f3e6d17',
      'k_bad15': 'd8e8bae3ee330a198d1f5e00ad7c5f9ed7c24c357c0a004322abca5d9cd17847'
    },
    {
      'message': 'Bitcoin',
      'privkey': 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
      'k_bad00': '36c848ffb2cbecc5422c33a994955b807665317c1ce2a0f59c689321aaa631cc',
      'k_bad01': '4ed8de1ec952a4f5b3bd79d1ff96446bcd45cabb00fc6ca127183e14671bcb85',
      'k_bad15': '56b6f47babc1662c011d3b1f93aa51a6e9b5f6512e9f2e16821a238d450a31f8'
    },
    {
      'message': 'i2FLPP8WEus5WPjpoHwheXOMSobUJVaZM1JPMQZq',
      'privkey': 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
      'k_bad00': '6e9b434fcc6bbb081a0463c094356b47d62d7efae7da9c518ed7bac23f4e2ed6',
      'k_bad01': 'ae5323ae338d6117ce8520a43b92eacd2ea1312ae514d53d8e34010154c593bb',
      'k_bad15': '3eaa1b61d1b8ab2f1ca71219c399f2b8b3defa624719f1e96fe3957628c2c4ea'
    },
    {
      'message': 'lEE55EJNP7aLrMtjkeJKKux4Yg0E8E1SAJnWTCEh',
      'privkey': '3881e5286abc580bb6139fe8e83d7c8271c6fe5e5c2d640c1f0ed0e1ee37edc9',
      'k_bad00': '5b606665a16da29cc1c5411d744ab554640479dd8abd3c04ff23bd6b302e7034',
      'k_bad01': 'f8b25263152c042807c992eacd2ac2cc5790d1e9957c394f77ea368e3d9923bd',
      'k_bad15': 'ea624578f7e7964ac1d84adb5b5087dd14f0ee78b49072aa19051cc15dab6f33'
    },
    {
      'message': '2SaVPvhxkAPrayIVKcsoQO5DKA8Uv5X/esZFlf+y',
      'privkey': '7259dff07922de7f9c4c5720d68c9745e230b32508c497dd24cb95ef18856631',
      'k_bad00': '3ab6c19ab5d3aea6aa0c6da37516b1d6e28e3985019b3adb388714e8f536686b',
      'k_bad01': '19af21b05004b0ce9cdca82458a371a9d2cf0dc35a813108c557b551c08eb52e',
      'k_bad15': '117a32665fca1b7137a91c4739ac5719fec0cf2e146f40f8e7c21b45a07ebc6a'
    },
    {
      'message': '00A0OwO2THi7j5Z/jp0FmN6nn7N/DQd6eBnCS+/b',
      'privkey': '0d6ea45d62b334777d6995052965c795a4f8506044b4fd7dc59c15656a28f7aa',
      'k_bad00': '79487de0c8799158294d94c0eb92ee4b567e4dc7ca18addc86e49d31ce1d2db6',
      'k_bad01': '9561d2401164a48a8f600882753b3105ebdd35e2358f4f808c4f549c91490009',
      'k_bad15': 'b0d273634129ff4dbdf0df317d4062a1dbc58818f88878ffdb4ec511c77976c0'
    }
  ];

  var result_txt = '\n----------------------\nResults\n----------------------\n\n';

  for (i = 0; i < test_vectors.length; i++) {
    var hash = Crypto.SHA256(test_vectors[i]['message'].split('').map(function(c) {
      return c.charCodeAt(0);
    }), {
      asBytes: true
    });
    var wif = coinjs.privkey2wif(test_vectors[i]['privkey']);

    var KBigInt = tx.deterministicK(wif, hash);
    var KBigInt0 = tx.deterministicK(wif, hash, 0);
    var KBigInt1 = tx.deterministicK(wif, hash, 1);
    var KBigInt15 = tx.deterministicK(wif, hash, 15);

    var K = Crypto.util.bytesToHex(KBigInt.toByteArrayUnsigned());
    var K0 = Crypto.util.bytesToHex(KBigInt0.toByteArrayUnsigned());
    var K1 = Crypto.util.bytesToHex(KBigInt1.toByteArrayUnsigned());
    var K15 = Crypto.util.bytesToHex(KBigInt15.toByteArrayUnsigned());

    if (K != test_vectors[i]['k_bad00']) {
      result_txt += 'Failed Test #' + (i + 1) + '\n       K = ' + K + '\nExpected = ' + test_vectors[i]['k_bad00'] + '\n\n';
    } else if (K0 != test_vectors[i]['k_bad00']) {
      result_txt += 'Failed Test #' + (i + 1) + '\n      K0 = ' + K0 + '\nExpected = ' + test_vectors[i]['k_bad00'] + '\n\n';
    } else if (K1 != test_vectors[i]['k_bad01']) {
      result_txt += 'Failed Test #' + (i + 1) + '\n      K1 = ' + K1 + '\nExpected = ' + test_vectors[i]['k_bad01'] + '\n\n';
    } else if (K15 != test_vectors[i]['k_bad15']) {
      result_txt += 'Failed Test #' + (i + 1) + '\n     K15 = ' + K15 + '\nExpected = ' + test_vectors[i]['k_bad15'] + '\n\n';
    };
  };

  if (result_txt.length < 60) {
    result_txt = 'All Tests OK!';
  };

  return result_txt;
};

/* start of hd functions, thanks bip32.org */
coinjs.hd = function(data) {

  var r = {};

  /* some hd value parsing */
  r.parse = function() {

    var bytes = [];

    // some quick validation
    if (typeof(data) == 'string') {
      var decoded = coinjs.base58decode(data);
      if (decoded.length == 82) {
        var checksum = decoded.slice(78, 82);
        var hash = Crypto.SHA256(Crypto.SHA256(decoded.slice(0, 78), {
          asBytes: true
        }), {
          asBytes: true
        });
        if (checksum[0] == hash[0] && checksum[1] == hash[1] && checksum[2] == hash[2] && checksum[3] == hash[3]) {
          bytes = decoded.slice(0, 78);
        }
      }
    }

    // actual parsing code
    if (bytes && bytes.length > 0) {
      r.version = coinjs.uint(bytes.slice(0, 4), 4);
      r.depth = coinjs.uint(bytes.slice(4, 5), 1);
      r.parent_fingerprint = bytes.slice(5, 9);
      r.child_index = coinjs.uint(bytes.slice(9, 13), 4);
      r.chain_code = bytes.slice(13, 45);
      r.key_bytes = bytes.slice(45, 78);

      var c = coinjs.compressed; // get current default
      coinjs.compressed = true;

      if (r.key_bytes[0] == 0x00) {
        r.type = 'private';
        var privkey = (r.key_bytes).slice(1, 33);
        var privkeyHex = Crypto.util.bytesToHex(privkey);
        var pubkey = coinjs.newPubkey(privkeyHex);

        r.keys = {
          'privkey': privkeyHex,
          'pubkey': pubkey,
          'address': coinjs.pubkey2address(pubkey),
          'wif': coinjs.privkey2wif(privkeyHex)
        };

      } else if (r.key_bytes[0] == 0x02 || r.key_bytes[0] == 0x03) {
        r.type = 'public';
        var pubkeyHex = Crypto.util.bytesToHex(r.key_bytes);

        r.keys = {
          'pubkey': pubkeyHex,
          'address': coinjs.pubkey2address(pubkeyHex)
        };
      } else {
        r.type = 'invalid';
      }

      r.keys_extended = r.extend();

      coinjs.compressed = c; // reset to default
    }
  }

  // extend prv/pub key
  r.extend = function() {
    var hd = coinjs.hd();
    return hd.make({
      'depth': (this.depth * 1) + 1,
      'parent_fingerprint': this.parent_fingerprint,
      'child_index': this.child_index,
      'chain_code': this.chain_code,
      'privkey': this.keys.privkey,
      'pubkey': this.keys.pubkey
    });
  }

  // derive key from index
  r.derive = function(i) {
    i = (i) ? i : 0;
    var blob = (Crypto.util.hexToBytes(this.keys.pubkey)).concat(coinjs.numToBytes(i, 4).reverse());

    var j = new jsSHA(Crypto.util.bytesToHex(blob), 'HEX');
    var hash = j.getHMAC(Crypto.util.bytesToHex(r.chain_code), "HEX", "SHA-512", "HEX");

    var il = new BigInteger(hash.slice(0, 64), 16);
    var ir = Crypto.util.hexToBytes(hash.slice(64, 128));

    var ecparams = EllipticCurve.getSECCurveByName("secp256k1");
    var curve = ecparams.getCurve();

    var k, key, pubkey, o;

    o = coinjs.clone(this);
    o.chain_code = ir;
    o.child_index = i;

    if (this.type == 'private') {
      // derive key pair from from a xprv key
      k = il.add(new BigInteger([0].concat(Crypto.util.hexToBytes(this.keys.privkey)))).mod(ecparams.getN());
      key = Crypto.util.bytesToHex(k.toByteArrayUnsigned());

      pubkey = coinjs.newPubkey(key);

      o.keys = {
        'privkey': key,
        'pubkey': pubkey,
        'wif': coinjs.privkey2wif(key),
        'address': coinjs.pubkey2address(pubkey)
      };

    } else if (this.type == 'public') {
      // derive xpub key from an xpub key
      q = ecparams.curve.decodePointHex(this.keys.pubkey);
      var curvePt = ecparams.getG().multiply(il).add(q);

      var x = curvePt.getX().toBigInteger();
      var y = curvePt.getY().toBigInteger();

      var publicKeyBytesCompressed = EllipticCurve.integerToBytes(x, 32)
      if (y.isEven()) {
        publicKeyBytesCompressed.unshift(0x02)
      } else {
        publicKeyBytesCompressed.unshift(0x03)
      }
      pubkey = Crypto.util.bytesToHex(publicKeyBytesCompressed);

      o.keys = {
        'pubkey': pubkey,
        'address': coinjs.pubkey2address(pubkey)
      }
    } else {
      // fail
    }

    o.parent_fingerprint = (ripemd160(Crypto.SHA256(Crypto.util.hexToBytes(r.keys.pubkey), {
      asBytes: true
    }), {
      asBytes: true
    })).slice(0, 4);
    o.keys_extended = o.extend();

    return o;
  }

  // make a master hd xprv/xpub
  r.master = function(pass) {
    var seed = (pass) ? Crypto.SHA256(pass) : coinjs.newPrivkey();
    var hasher = new jsSHA(seed, 'HEX');
    var I = hasher.getHMAC("Bitcoin seed", "TEXT", "SHA-512", "HEX");

    var privkey = Crypto.util.hexToBytes(I.slice(0, 64));
    var chain = Crypto.util.hexToBytes(I.slice(64, 128));

    var hd = coinjs.hd();
    return hd.make({
      'depth': 0,
      'parent_fingerprint': [0, 0, 0, 0],
      'child_index': 0,
      'chain_code': chain,
      'privkey': I.slice(0, 64),
      'pubkey': coinjs.newPubkey(I.slice(0, 64))
    });
  }

  // encode data to a base58 string
  r.make = function(data) { // { (int) depth, (array) parent_fingerprint, (int) child_index, (byte array) chain_code, (hex str) privkey, (hex str) pubkey}
    var k = [];

    //depth
    k.push(data.depth * 1);

    //parent fingerprint
    k = k.concat(data.parent_fingerprint);

    //child index
    k = k.concat((coinjs.numToBytes(data.child_index, 4)).reverse());

    //Chain code
    k = k.concat(data.chain_code);

    var o = {}; // results

    //encode xprv key
    if (data.privkey) {
      var prv = (coinjs.numToBytes(coinjs.hdkey.prv, 4)).reverse();
      prv = prv.concat(k);
      prv.push(0x00);
      prv = prv.concat(Crypto.util.hexToBytes(data.privkey));
      var hash = Crypto.SHA256(Crypto.SHA256(prv, {
        asBytes: true
      }), {
        asBytes: true
      });
      var checksum = hash.slice(0, 4);
      var ret = prv.concat(checksum);
      o.privkey = coinjs.base58encode(ret);
    }

    //encode xpub key
    if (data.pubkey) {
      var pub = (coinjs.numToBytes(coinjs.hdkey.pub, 4)).reverse();
      pub = pub.concat(k);
      pub = pub.concat(Crypto.util.hexToBytes(data.pubkey));
      var hash = Crypto.SHA256(Crypto.SHA256(pub, {
        asBytes: true
      }), {
        asBytes: true
      });
      var checksum = hash.slice(0, 4);
      var ret = pub.concat(checksum);
      o.pubkey = coinjs.base58encode(ret);
    }
    return o;
  }

  r.parse();
  return r;
}


/* start of script functions */
coinjs.script = function(data) {
  var r = {};

  if (!data) {
    r.buffer = [];
  } else if ("string" == typeof data) {
    r.buffer = Crypto.util.hexToBytes(data);
  } else if (coinjs.isArray(data)) {
    r.buffer = data;
  } else if (data instanceof coinjs.script) {
    r.buffer = data.buffer;
  } else {
    r.buffer = data;
  }

  /* parse buffer array */
  r.parse = function() {

    var self = this;
    r.chunks = [];
    var i = 0;

    function readChunk(n) {
      self.chunks.push(self.buffer.slice(i, i + n));
      i += n;
    };

    while (i < this.buffer.length) {
      var opcode = this.buffer[i++];
      if (opcode >= 0xF0) {
        opcode = (opcode << 8) | this.buffer[i++];
      }

      var len;
      if (opcode > 0 && opcode < 76) { //OP_PUSHDATA1
        readChunk(opcode);
      } else if (opcode == 76) { //OP_PUSHDATA1
        len = this.buffer[i++];
        readChunk(len);
      } else if (opcode == 77) { //OP_PUSHDATA2
        len = (this.buffer[i++] << 8) | this.buffer[i++];
        readChunk(len);
      } else if (opcode == 78) { //OP_PUSHDATA4
        len = (this.buffer[i++] << 24) | (this.buffer[i++] << 16) | (this.buffer[i++] << 8) | this.buffer[i++];
        readChunk(len);
      } else {
        this.chunks.push(opcode);
      }

      if (i < 0x00) {
        break;
      }
    }

    return true;
  };

  /* decode the redeemscript of a multisignature transaction */
  r.decodeRedeemScript = function(script) {
    var r = false;
    try {
      var s = coinjs.script(Crypto.util.hexToBytes(script));
      if ((s.chunks.length >= 3) && s.chunks[s.chunks.length - 1] == 174) { //OP_CHECKMULTISIG
        r = {};
        r.signaturesRequired = s.chunks[0] - 80;
        var pubkeys = [];
        for (var i = 1; i < s.chunks.length - 2; i++) {
          pubkeys.push(Crypto.util.bytesToHex(s.chunks[i]));
        }
        r.pubkeys = pubkeys;
        var multi = coinjs.pubkeys2MultisigAddress(pubkeys, r.signaturesRequired);
        r.address = multi['address'];
        r.type = 'multisig__'; // using __ for now to differentiat from the other object .type == "multisig"
        var rs = Crypto.util.bytesToHex(s.buffer);
        r.redeemscript = rs;

      } else if ((s.chunks.length == 2) && (s.buffer[0] == 0 && s.buffer[1] == 20)) { // SEGWIT
        r = {};
        r.type = "segwit__";
        var rs = Crypto.util.bytesToHex(s.buffer);
        r.address = coinjs.pubkey2address(rs, coinjs.multisig);
        r.redeemscript = rs;

      } else if (s.chunks.length == 5 && s.chunks[1] == 177 && s.chunks[2] == 117 && s.chunks[4] == 172) {
        // ^ <unlocktime> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG ^
        r = {}
        r.pubkey = Crypto.util.bytesToHex(s.chunks[3]);
        r.checklocktimeverify = coinjs.bytesToNum(s.chunks[0].slice());
        r.address = coinjs.simpleHodlAddress(r.pubkey, r.checklocktimeverify).address;
        var rs = Crypto.util.bytesToHex(s.buffer);
        r.redeemscript = rs;
        r.type = "hodl__";
      }
    } catch (e) {
      // console.log(e);
      r = false;
    }
    return r;
  }

  /* create output script to spend */
  r.spendToScript = function(address) {
    var addr = address.bytes ? address : coinjs.addressDecode(address);
    var s = coinjs.script();
    if (addr.type == "bech32") {
      s.writeOp(0);
      s.writeBytes(Crypto.util.hexToBytes(addr.redeemscript));
    } else if (addr.version == coinjs.multisig) { // multisig address
      s.writeOp(169); //OP_HASH160
      s.writeBytes(addr.bytes);
      s.writeOp(135); //OP_EQUAL
    } else { // regular address
      s.writeOp(118); //OP_DUP
      s.writeOp(169); //OP_HASH160
      s.writeBytes(addr.bytes);
      s.writeOp(136); //OP_EQUALVERIFY
      s.writeOp(172); //OP_CHECKSIG
    }
    return s;
  }

  /* geneate a (script) pubkey hash of the address - used for when signing */
  r.pubkeyHash = function(address) {
    var addr = coinjs.addressDecode(address);
    var s = coinjs.script();
    s.writeOp(118); //OP_DUP
    s.writeOp(169); //OP_HASH160
    s.writeBytes(addr.bytes);
    s.writeOp(136); //OP_EQUALVERIFY
    s.writeOp(172); //OP_CHECKSIG
    return s;
  }

  /* write to buffer */
  r.writeOp = function(op) {
    this.buffer.push(op);
    this.chunks.push(op);
    return true;
  }

  /* write bytes to buffer */
  r.writeBytes = function(data) {
    if (data.length < 76) { //OP_PUSHDATA1
      this.buffer.push(data.length);
    } else if (data.length <= 0xff) {
      this.buffer.push(76); //OP_PUSHDATA1
      this.buffer.push(data.length);
    } else if (data.length <= 0xffff) {
      this.buffer.push(77); //OP_PUSHDATA2
      this.buffer.push(data.length & 0xff);
      this.buffer.push((data.length >>> 8) & 0xff);
    } else {
      this.buffer.push(78); //OP_PUSHDATA4
      this.buffer.push(data.length & 0xff);
      this.buffer.push((data.length >>> 8) & 0xff);
      this.buffer.push((data.length >>> 16) & 0xff);
      this.buffer.push((data.length >>> 24) & 0xff);
    }
    this.buffer = this.buffer.concat(data);
    this.chunks.push(data);
    return true;
  }

  r.parse();
  return r;
}

/* start of transaction functions */

coinjs.createTransaction = (options) => {
  var tx = coinjs.transaction();

  // if(($("#nLockTime").val()).match(/^[0-9]+$/g)){
  // 	tx.lock_time = $("#nLockTime").val()*1;
  // }

  const paymentOutputs = options.paymentOutputs;
  const paymentInputs = options.paymentInputs;

  let errors = [];
  let error = false;
  for (let i = 0; i < paymentInputs.length; i++) {
    const inputRow = paymentInputs[i];
    const txid = inputRow.transaction_id;
    const txidScript = inputRow.transaction_id_script
    const txIDN = inputRow.transaction_id_n;

    if (!txid.match(/^[a-f0-9]+$/i)) {
      const newError = {
        error: 'Invalid Transaction ID',
        txid: txid
      };

      errors.push(newError)
      error = true;
    } else if (txidScript && !txidScript.match(/^[a-f0-9]+$/i)) {
      const newError = {
        error: 'Invalid Transaction ID Script',
        transaction_id_script: txidScript
      }
      errors.push(newError)
      error = true;
    } else if (txIDN && !txIDN.toString().match(/^[0-9]+$/i)) {
      const newError = {
        error: 'Invalid Transaction ID N',
        transaction_id_n: txIDN
      }
      errors.push(newError)
      error = true;
    }

    if (!error) tx.addinput(txid, txIDN, txidScript, null);
  }

  for (let i = 0; i < paymentOutputs.length; i++) {
    const outputRow = paymentOutputs[i];
    const outgoingAddress = coinjs.addressDecode(outputRow.address);

    if (!outgoingAddress) outgoingAddress = coinjs.bech32_decode(outputRow.address);

    const paymentAmount = outputRow.amount;

    const isValidLegacyAddress = outgoingAddress.version == coinjs.pub;
    const isValidMultiSig = outgoingAddress.version == coinjs.multisig;
    const isValidBitcoinAddress = outgoingAddress.type == 'bech32';

    const isValidAddress = isValidLegacyAddress || isValidMultiSig || isValidBitcoinAddress;
    const isValidAmount = parseFloat(paymentAmount) > 0;

    if (isValidAddress && isValidAmount) {
      tx.addoutput(outgoingAddress, paymentAmount);
    } else if (outgoingAddress.version === 42 && isValidAmount) {
      tx.addstealth(outgoingAddress, paymentAmount);
    } else if (options.opReturn && outgoingAddress.match(/^[a-f0-9]+$/ig) && outgoingAddress.length < 160 && (outgoingAddress.length % 2) == 0) {
      tx.adddata(outgoingAddress);
    } else {
      error = true;

      if (!isValidAmount) {
        errors.push({
          error: 'Invalid payment amount',
          address: outgoingAddress,
          amount: paymentAmount
        })
      }
      errors.push({
        error: 'Invalid Address',
        address: outgoingAddress
      });
    }
  }

  if (error) {
    return errors;
  } else {
    if (options.return) {
      return tx;
    } else {
      return tx.serialize();
    }
  }
}

/* create a new transaction object */
coinjs.transaction = function() {

  var r = {};
  r.version = 1;
  r.lock_time = 0;
  r.ins = [];
  r.outs = [];
  r.witness = false;
  r.timestamp = null;
  r.block = null;

  /* add an input to a transaction */
  r.addinput = function(txid, index, script, sequence) {
    var o = {};
    o.outpoint = {
      'hash': txid,
      'index': index
    };
    o.script = coinjs.script(script || []);
    o.sequence = sequence || ((r.lock_time == 0) ? 4294967295 : 0);
    return this.ins.push(o);
  }

  /* add an output to a transaction */
  r.addoutput = function(address, value) {
    var o = {};
    o.value = new BigInteger('' + Math.round((value * 1) * 1e8), 10);
    var s = coinjs.script();
    o.script = s.spendToScript(address);

    return this.outs.push(o);
  }

  /* add two outputs for stealth addresses to a transaction */
  r.addstealth = function(stealth, value) {
    var ephemeralKeyBigInt = BigInteger.fromByteArrayUnsigned(Crypto.util.hexToBytes(coinjs.newPrivkey()));
    var curve = EllipticCurve.getSECCurveByName("secp256k1");

    var p = EllipticCurve.fromHex("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F");
    var a = BigInteger.ZERO;
    var b = EllipticCurve.fromHex("7");
    var calccurve = new EllipticCurve.CurveFp(p, a, b);

    var ephemeralPt = curve.getG().multiply(ephemeralKeyBigInt);
    var scanPt = calccurve.decodePointHex(stealth.scankey);
    var sharedPt = scanPt.multiply(ephemeralKeyBigInt);
    var stealthindexKeyBigInt = BigInteger.fromByteArrayUnsigned(Crypto.SHA256(sharedPt.getEncoded(true), {
      asBytes: true
    }));

    var stealthindexPt = curve.getG().multiply(stealthindexKeyBigInt);
    var spendPt = calccurve.decodePointHex(stealth.spendkey);
    var addressPt = spendPt.add(stealthindexPt);

    var sendaddress = coinjs.pubkey2address(Crypto.util.bytesToHex(addressPt.getEncoded(true)));


    var OPRETBytes = [6].concat(Crypto.util.randomBytes(4)).concat(ephemeralPt.getEncoded(true)); // ephemkey data
    var q = coinjs.script();
    q.writeOp(106); // OP_RETURN
    q.writeBytes(OPRETBytes);
    v = {};
    v.value = 0;
    v.script = q;

    this.outs.push(v);

    var o = {};
    o.value = new BigInteger('' + Math.round((value * 1) * 1e8), 10);
    var s = coinjs.script();
    o.script = s.spendToScript(sendaddress);

    return this.outs.push(o);
  }

  /* add data to a transaction */
  r.adddata = function(data) {
    var r = false;
    if (((data.match(/^[a-f0-9]+$/gi)) && data.length < 160) && (data.length % 2) == 0) {
      var s = coinjs.script();
      s.writeOp(106); // OP_RETURN
      s.writeBytes(Crypto.util.hexToBytes(data));
      o = {};
      o.value = 0;
      o.script = s;
      return this.outs.push(o);
    }
    return r;
  }

  /* list unspent transactions */
  r.listUnspent = function(address, callback) {
    coinjs.ajax(coinjs.host + '?uid=' + coinjs.uid + '&key=' + coinjs.key + '&setmodule=addresses&request=unspent&address=' + address + '&r=' + Math.random(), callback, "GET");
  }

  /* add unspent to transaction */
  r.addUnspent = function(address, callback, script, segwit, sequence) {
    var self = this;
    this.listUnspent(address, function(data) {
      var s = coinjs.script();
      var value = 0;
      var total = 0;
      var x = {};


      xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
      xmlDoc.async = false;
      xmlDoc.loadXML(data);


      var unspent = xmlDoc.getElementsByTagName("unspent")[0];

      for (i = 1; i <= unspent.childElementCount; i++) {
        var u = xmlDoc.getElementsByTagName("unspent_" + i)[0]
        var txhash = (u.getElementsByTagName("tx_hash")[0].childNodes[0].nodeValue).match(/.{1,2}/g).reverse().join("") + '';
        var n = u.getElementsByTagName("tx_output_n")[0].childNodes[0].nodeValue;
        var scr = script || u.getElementsByTagName("script")[0].childNodes[0].nodeValue;

        if (segwit) {
          /* this is a small hack to include the value with the redeemscript to make the signing procedure smoother.
          It is not standard and removed during the signing procedure. */

          s = coinjs.script();
          s.writeBytes(Crypto.util.hexToBytes(script));
          s.writeOp(0);
          s.writeBytes(coinjs.numToBytes(u.getElementsByTagName("value")[0].childNodes[0].nodeValue * 1, 8));
          scr = Crypto.util.bytesToHex(s.buffer);
        }

        var seq = sequence || false;
        self.addinput(txhash, n, scr, seq);
        value += u.getElementsByTagName("value")[0].childNodes[0].nodeValue * 1;
        total++;
      }

      x.unspent = $(xmlDoc).find("unspent");
      x.value = value;
      x.total = total;
      return callback(x);
    });
  }

  /* add unspent and sign */
  r.addUnspentAndSign = function(wif, callback) {
    var self = this;
    var address = coinjs.wif2address(wif);
    self.addUnspent(address['address'], function(data) {
      self.sign(wif);
      return callback(data);
    });
  }

  /* broadcast a transaction */
  r.broadcast = function(callback, txhex) {
    var tx = txhex || this.serialize();
    coinjs.ajax(coinjs.host + '?uid=' + coinjs.uid + '&key=' + coinjs.key + '&setmodule=bitcoin&request=sendrawtransaction&rawtx=' + tx + '&r=' + Math.random(), callback, "GET");
  }

  /* generate the transaction hash to sign from a transaction input */
  r.transactionHash = function(index, sigHashType) {

    var clone = coinjs.clone(this);
    var shType = sigHashType || 1;

    /* black out all other ins, except this one */
    for (var i = 0; i < clone.ins.length; i++) {
      if (index != i) {
        clone.ins[i].script = coinjs.script();
      }
    }

    var extract = this.extractScriptKey(index);
    clone.ins[index].script = coinjs.script(extract['script']);

    if ((clone.ins) && clone.ins[index]) {

      /* SIGHASH : For more info on sig hashs see https://en.bitcoin.it/wiki/OP_CHECKSIG
        and https://bitcoin.org/en/developer-guide#signature-hash-type */

      if (shType == 1) {
        //SIGHASH_ALL 0x01

      } else if (shType == 2) {
        //SIGHASH_NONE 0x02
        clone.outs = [];
        for (var i = 0; i < clone.ins.length; i++) {
          if (index != i) {
            clone.ins[i].sequence = 0;
          }
        }

      } else if (shType == 3) {

        //SIGHASH_SINGLE 0x03
        clone.outs.length = index + 1;

        for (var i = 0; i < index; i++) {
          clone.outs[i].value = -1;
          clone.outs[i].script.buffer = [];
        }

        for (var i = 0; i < clone.ins.length; i++) {
          if (index != i) {
            clone.ins[i].sequence = 0;
          }
        }

      } else if (shType >= 128) {
        //SIGHASH_ANYONECANPAY 0x80
        clone.ins = [clone.ins[index]];

        if (shType == 129) {
          // SIGHASH_ALL + SIGHASH_ANYONECANPAY

        } else if (shType == 130) {
          // SIGHASH_NONE + SIGHASH_ANYONECANPAY
          clone.outs = [];

        } else if (shType == 131) {
          // SIGHASH_SINGLE + SIGHASH_ANYONECANPAY
          clone.outs.length = index + 1;
          for (var i = 0; i < index; i++) {
            clone.outs[i].value = -1;
            clone.outs[i].script.buffer = [];
          }
        }
      }

      var buffer = Crypto.util.hexToBytes(clone.serialize());
      buffer = buffer.concat(coinjs.numToBytes(parseInt(shType), 4));
      var hash = Crypto.SHA256(buffer, {
        asBytes: true
      });
      var r = Crypto.util.bytesToHex(Crypto.SHA256(hash, {
        asBytes: true
      }));
      return r;
    } else {
      return false;
    }
  }

  /* generate a segwit transaction hash to sign from a transaction input */
  r.transactionHashSegWitV0 = function(index, sigHashType) {
    /*
        Notice: coinb.in by default, deals with segwit transactions in a non-standard way.
        Segwit transactions require that input values are included in the transaction hash.
        To save wasting resources and potentially slowing down this service, we include the amount with the
        redeem script to generate the transaction hash and remove it after its signed.
    */

    // start redeem script check
    var extract = this.extractScriptKey(index);
    if (extract['type'] != 'segwit') {
      return {
        'result': 0,
        'fail': 'redeemscript',
        'response': 'redeemscript missing or not valid for segwit'
      };
    }

    if (extract['value'] == -1) {
      return {
        'result': 0,
        'fail': 'value',
        'response': 'unable to generate a valid segwit hash without a value'
      };
    }

    var scriptcode = Crypto.util.hexToBytes(extract['script']);

    // end of redeem script check

    /* P2WPKH */
    if (scriptcode.length == 20) {
      scriptcode = [0x00, 0x14].concat(scriptcode);
    }

    if (scriptcode.length == 22) {
      scriptcode = scriptcode.slice(1);
      scriptcode.unshift(25, 118, 169);
      scriptcode.push(136, 172);
    }

    var value = coinjs.numToBytes(extract['value'], 8);

    // start

    var zero = coinjs.numToBytes(0, 32);
    var version = coinjs.numToBytes(parseInt(this.version), 4);

    var bufferTmp = [];
    if (!(sigHashType >= 80)) { // not sighash anyonecanpay
      for (var i = 0; i < this.ins.length; i++) {
        bufferTmp = bufferTmp.concat(Crypto.util.hexToBytes(this.ins[i].outpoint.hash).reverse());
        bufferTmp = bufferTmp.concat(coinjs.numToBytes(this.ins[i].outpoint.index, 4));
      }
    }
    var hashPrevouts = bufferTmp.length >= 1 ? Crypto.SHA256(Crypto.SHA256(bufferTmp, {
      asBytes: true
    }), {
      asBytes: true
    }) : zero;

    var bufferTmp = [];
    if (!(sigHashType >= 80) && sigHashType != 2 && sigHashType != 3) { // not sighash anyonecanpay & single & none
      for (var i = 0; i < this.ins.length; i++) {
        bufferTmp = bufferTmp.concat(coinjs.numToBytes(this.ins[i].sequence, 4));
      }
    }
    var hashSequence = bufferTmp.length >= 1 ? Crypto.SHA256(Crypto.SHA256(bufferTmp, {
      asBytes: true
    }), {
      asBytes: true
    }) : zero;

    var outpoint = Crypto.util.hexToBytes(this.ins[index].outpoint.hash).reverse();
    outpoint = outpoint.concat(coinjs.numToBytes(this.ins[index].outpoint.index, 4));

    var nsequence = coinjs.numToBytes(this.ins[index].sequence, 4);
    var hashOutputs = zero;
    var bufferTmp = [];
    if (sigHashType != 2 && sigHashType != 3) { // not sighash single & none
      for (var i = 0; i < this.outs.length; i++) {
        bufferTmp = bufferTmp.concat(coinjs.numToBytes(this.outs[i].value, 8));
        bufferTmp = bufferTmp.concat(coinjs.numToVarInt(this.outs[i].script.buffer.length));
        bufferTmp = bufferTmp.concat(this.outs[i].script.buffer);
      }
      hashOutputs = Crypto.SHA256(Crypto.SHA256(bufferTmp, {
        asBytes: true
      }), {
        asBytes: true
      });

    } else if ((sigHashType == 2) && index < this.outs.length) { // is sighash single
      bufferTmp = bufferTmp.concat(coinjs.numToBytes(this.outs[index].value, 8));
      bufferTmp = bufferTmp.concat(coinjs.numToVarInt(this.outs[i].script.buffer.length));
      bufferTmp = bufferTmp.concat(this.outs[index].script.buffer);
      hashOutputs = Crypto.SHA256(Crypto.SHA256(bufferTmp, {
        asBytes: true
      }), {
        asBytes: true
      });
    }

    var locktime = coinjs.numToBytes(this.lock_time, 4);
    var sighash = coinjs.numToBytes(sigHashType, 4);

    var buffer = [];
    buffer = buffer.concat(version);
    buffer = buffer.concat(hashPrevouts);
    buffer = buffer.concat(hashSequence);
    buffer = buffer.concat(outpoint);
    buffer = buffer.concat(scriptcode);
    buffer = buffer.concat(value);
    buffer = buffer.concat(nsequence);
    buffer = buffer.concat(hashOutputs);
    buffer = buffer.concat(locktime);
    buffer = buffer.concat(sighash);

    var hash = Crypto.SHA256(buffer, {
      asBytes: true
    });
    return {
      'result': 1,
      'hash': Crypto.util.bytesToHex(Crypto.SHA256(hash, {
        asBytes: true
      })),
      'response': 'hash generated'
    };
  }

  /* extract the scriptSig, used in the transactionHash() function */
  r.extractScriptKey = function(index) {
    if (this.ins[index]) {
      if ((this.ins[index].script.chunks.length == 5) && this.ins[index].script.chunks[4] == 172 && coinjs.isArray(this.ins[index].script.chunks[2])) { //OP_CHECKSIG
        // regular scriptPubkey (not signed)
        return {
          'type': 'scriptpubkey',
          'signed': 'false',
          'signatures': 0,
          'script': Crypto.util.bytesToHex(this.ins[index].script.buffer)
        };
      } else if ((this.ins[index].script.chunks.length == 2) && this.ins[index].script.chunks[0][0] == 48 && this.ins[index].script.chunks[1].length == 5 && this.ins[index].script.chunks[1][1] == 177) { //OP_CHECKLOCKTIMEVERIFY
        // hodl script (signed)
        return {
          'type': 'hodl',
          'signed': 'true',
          'signatures': 1,
          'script': Crypto.util.bytesToHex(this.ins[index].script.buffer)
        };
      } else if ((this.ins[index].script.chunks.length == 2) && this.ins[index].script.chunks[0][0] == 48) {
        // regular scriptPubkey (probably signed)
        return {
          'type': 'scriptpubkey',
          'signed': 'true',
          'signatures': 1,
          'script': Crypto.util.bytesToHex(this.ins[index].script.buffer)
        };
      } else if (this.ins[index].script.chunks.length == 5 && this.ins[index].script.chunks[1] == 177) { //OP_CHECKLOCKTIMEVERIFY
        // hodl script (not signed)
        return {
          'type': 'hodl',
          'signed': 'false',
          'signatures': 0,
          'script': Crypto.util.bytesToHex(this.ins[index].script.buffer)
        };
      } else if ((this.ins[index].script.chunks.length <= 3 && this.ins[index].script.chunks.length > 0) && ((this.ins[index].script.chunks[0].length == 22 && this.ins[index].script.chunks[0][0] == 0) || (this.ins[index].script.chunks[0].length == 20 && this.ins[index].script.chunks[1] == 0))) {
        var signed = ((this.witness[index]) && this.witness[index].length == 2) ? 'true' : 'false';
        var sigs = (signed == 'true') ? 1 : 0;
        var value = -1; // no value found
        if ((this.ins[index].script.chunks[2]) && this.ins[index].script.chunks[2].length == 8) {
          value = coinjs.bytesToNum(this.ins[index].script.chunks[2]); // value found encoded in transaction (THIS IS NON STANDARD)
        }
        return {
          'type': 'segwit',
          'signed': signed,
          'signatures': sigs,
          'script': Crypto.util.bytesToHex(this.ins[index].script.chunks[0]),
          'value': value
        };
      } else if (this.ins[index].script.chunks[0] == 0 && this.ins[index].script.chunks[this.ins[index].script.chunks.length - 1][this.ins[index].script.chunks[this.ins[index].script.chunks.length - 1].length - 1] == 174) { // OP_CHECKMULTISIG
        // multisig script, with signature(s) included
        return {
          'type': 'multisig',
          'signed': 'true',
          'signatures': this.ins[index].script.chunks.length - 2,
          'script': Crypto.util.bytesToHex(this.ins[index].script.chunks[this.ins[index].script.chunks.length - 1])
        };
      } else if (this.ins[index].script.chunks[0] >= 80 && this.ins[index].script.chunks[this.ins[index].script.chunks.length - 1] == 174) { // OP_CHECKMULTISIG
        // multisig script, without signature!
        return {
          'type': 'multisig',
          'signed': 'false',
          'signatures': 0,
          'script': Crypto.util.bytesToHex(this.ins[index].script.buffer)
        };
      } else if (this.ins[index].script.chunks.length == 0) {
        // empty
        return {
          'type': 'empty',
          'signed': 'false',
          'signatures': 0,
          'script': ''
        };
      } else {
        // something else
        return {
          'type': 'unknown',
          'signed': 'false',
          'signatures': 0,
          'script': Crypto.util.bytesToHex(this.ins[index].script.buffer)
        };
      }
    } else {
      return false;
    }
  }

  /* generate a signature from a transaction hash */
  r.transactionSig = function(index, wif, sigHashType, txhash) {

    function serializeSig(r, s) {
      var rBa = r.toByteArraySigned();
      var sBa = s.toByteArraySigned();

      var sequence = [];
      sequence.push(0x02); // INTEGER
      sequence.push(rBa.length);
      sequence = sequence.concat(rBa);

      sequence.push(0x02); // INTEGER
      sequence.push(sBa.length);
      sequence = sequence.concat(sBa);

      sequence.unshift(sequence.length);
      sequence.unshift(0x30); // SEQUENCE

      return sequence;
    }

    var shType = sigHashType || 1;
    var hash = txhash || Crypto.util.hexToBytes(this.transactionHash(index, shType));

    if (hash) {
      var curve = EllipticCurve.getSECCurveByName("secp256k1");
      var key = coinjs.wif2privkey(wif);
      var priv = BigInteger.fromByteArrayUnsigned(Crypto.util.hexToBytes(key['privkey']));
      var n = curve.getN();
      var e = BigInteger.fromByteArrayUnsigned(hash);
      var badrs = 0
      do {
        var k = this.deterministicK(wif, hash, badrs);
        var G = curve.getG();
        var Q = G.multiply(k);
        var r = Q.getX().toBigInteger().mod(n);
        var s = k.modInverse(n).multiply(e.add(priv.multiply(r))).mod(n);
        badrs++
      } while (r.compareTo(BigInteger.ZERO) <= 0 || s.compareTo(BigInteger.ZERO) <= 0);

      // Force lower s values per BIP62
      var halfn = n.shiftRight(1);
      if (s.compareTo(halfn) > 0) {
        s = n.subtract(s);
      };

      var sig = serializeSig(r, s);
      sig.push(parseInt(shType, 10));

      return Crypto.util.bytesToHex(sig);
    } else {
      return false;
    }
  }

  // https://tools.ietf.org/html/rfc6979#section-3.2
  r.deterministicK = function(wif, hash, badrs) {
    // if r or s were invalid when this function was used in signing,
    // we do not want to actually compute r, s here for efficiency, so,
    // we can increment badrs. explained at end of RFC 6979 section 3.2

    // wif is b58check encoded wif privkey.
    // hash is byte array of transaction digest.
    // badrs is used only if the k resulted in bad r or s.

    // some necessary things out of the way for clarity.
    badrs = badrs || 0;
    var key = coinjs.wif2privkey(wif);
    var x = Crypto.util.hexToBytes(key['privkey'])
    var curve = EllipticCurve.getSECCurveByName("secp256k1");
    var N = curve.getN();

    // Step: a
    // hash is a byteArray of the message digest. so h1 == hash in our case

    // Step: b
    var v = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

    // Step: c
    var k = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // Step: d
    k = Crypto.HMAC(Crypto.SHA256, v.concat([0]).concat(x).concat(hash), k, {
      asBytes: true
    });

    // Step: e
    v = Crypto.HMAC(Crypto.SHA256, v, k, {
      asBytes: true
    });

    // Step: f
    k = Crypto.HMAC(Crypto.SHA256, v.concat([1]).concat(x).concat(hash), k, {
      asBytes: true
    });

    // Step: g
    v = Crypto.HMAC(Crypto.SHA256, v, k, {
      asBytes: true
    });

    // Step: h1
    var T = [];

    // Step: h2 (since we know tlen = qlen, just copy v to T.)
    v = Crypto.HMAC(Crypto.SHA256, v, k, {
      asBytes: true
    });
    T = v;

    // Step: h3
    var KBigInt = BigInteger.fromByteArrayUnsigned(T);

    // loop if KBigInt is not in the range of [1, N-1] or if badrs needs incrementing.
    var i = 0
    while (KBigInt.compareTo(N) >= 0 || KBigInt.compareTo(BigInteger.ZERO) <= 0 || i < badrs) {
      k = Crypto.HMAC(Crypto.SHA256, v.concat([0]), k, {
        asBytes: true
      });
      v = Crypto.HMAC(Crypto.SHA256, v, k, {
        asBytes: true
      });
      v = Crypto.HMAC(Crypto.SHA256, v, k, {
        asBytes: true
      });
      T = v;
      KBigInt = BigInteger.fromByteArrayUnsigned(T);
      i++
    };

    return KBigInt;
  };

  /* sign a "standard" input */
  r.signinput = function(index, wif, sigHashType) {
    var key = coinjs.wif2pubkey(wif);
    var shType = sigHashType || 1;
    var signature = this.transactionSig(index, wif, shType);
    var s = coinjs.script();
    s.writeBytes(Crypto.util.hexToBytes(signature));
    s.writeBytes(Crypto.util.hexToBytes(key['pubkey']));
    this.ins[index].script = s;
    return true;
  }

  /* signs a time locked / hodl input */
  r.signhodl = function(index, wif, sigHashType) {
    var shType = sigHashType || 1;
    var signature = this.transactionSig(index, wif, shType);
    var redeemScript = this.ins[index].script.buffer
    var s = coinjs.script();
    s.writeBytes(Crypto.util.hexToBytes(signature));
    s.writeBytes(redeemScript);
    this.ins[index].script = s;
    return true;
  }

  /* sign a multisig input */
  r.signmultisig = function(index, wif, sigHashType) {

    function scriptListPubkey(redeemScript) {
      var r = {};
      for (var i = 1; i < redeemScript.chunks.length - 2; i++) {
        r[i] = Crypto.util.hexToBytes(coinjs.pubkeydecompress(Crypto.util.bytesToHex(redeemScript.chunks[i])));
      }
      return r;
    }

    function scriptListSigs(scriptSig) {
      var r = {};
      var c = 0;
      if (scriptSig.chunks[0] == 0 && scriptSig.chunks[scriptSig.chunks.length - 1][scriptSig.chunks[scriptSig.chunks.length - 1].length - 1] == 174) {
        for (var i = 1; i < scriptSig.chunks.length - 1; i++) {
          if (scriptSig.chunks[i] != 0) {
            c++;
            r[c] = scriptSig.chunks[i];
          }
        }
      }
      return r;
    }

    var redeemScript = (this.ins[index].script.chunks[this.ins[index].script.chunks.length - 1] == 174) ? this.ins[index].script.buffer : this.ins[index].script.chunks[this.ins[index].script.chunks.length - 1];

    var pubkeyList = scriptListPubkey(coinjs.script(redeemScript));
    var sigsList = scriptListSigs(this.ins[index].script);

    var shType = sigHashType || 1;
    var sighash = Crypto.util.hexToBytes(this.transactionHash(index, shType));
    var signature = Crypto.util.hexToBytes(this.transactionSig(index, wif, shType));

    sigsList[coinjs.countObject(sigsList) + 1] = signature;

    var s = coinjs.script();

    s.writeOp(0);

    for (x in pubkeyList) {
      for (y in sigsList) {
        this.ins[index].script.buffer = redeemScript;
        sighash = Crypto.util.hexToBytes(this.transactionHash(index, sigsList[y].slice(-1)[0] * 1));
        if (coinjs.verifySignature(sighash, sigsList[y], pubkeyList[x])) {
          s.writeBytes(sigsList[y]);
        }
      }
    }

    s.writeBytes(redeemScript);
    this.ins[index].script = s;
    return true;
  }

  /* sign segwit input */
  r.signsegwit = function(index, wif, sigHashType) {
    var shType = sigHashType || 1;

    var wif2 = coinjs.wif2pubkey(wif);
    var segwit = coinjs.BitcoinAddress(wif2['pubkey']);
    var bech32 = coinjs.bech32Address(wif2['pubkey']);

    if ((segwit['redeemscript'] == Crypto.util.bytesToHex(this.ins[index].script.chunks[0])) || (bech32['redeemscript'] == Crypto.util.bytesToHex(this.ins[index].script.chunks[0]))) {
      var txhash = this.transactionHashSegWitV0(index, shType);

      if (txhash.result == 1) {

        var segwitHash = Crypto.util.hexToBytes(txhash.hash);
        var signature = this.transactionSig(index, wif, shType, segwitHash);

        // remove any non standard data we store, i.e. input value
        var script = coinjs.script();
        script.writeBytes(this.ins[index].script.chunks[0]);
        this.ins[index].script = script;

        if (!coinjs.isArray(this.witness)) {
          this.witness = [];
        }

        this.witness.push([signature, wif2['pubkey']]);

        /* attempt to reorder witness data as best as we can.
            data can't be easily validated at this stage as
            we dont have access to the inputs value and
            making a web call will be too slow. */

        var witness_order = [];
        var witness_used = [];
        for (var i = 0; i < this.ins.length; i++) {
          for (var y = 0; y < this.witness.length; y++) {
            if (!witness_used.includes(y)) {
              var sw = coinjs.BitcoinAddress(this.witness[y][1]);
              var b32 = coinjs.bech32Address(this.witness[y][1]);
              var rs = '';

              if (this.ins[i].script.chunks.length >= 1) {
                rs = Crypto.util.bytesToHex(this.ins[i].script.chunks[0]);
              } else if (this.ins[i].script.chunks.length == 0) {
                rs = b32['redeemscript'];
              }

              if ((sw['redeemscript'] == rs) || (b32['redeemscript'] == rs)) {
                witness_order.push(this.witness[y]);
                witness_used.push(y);

                // bech32, empty redeemscript
                if (b32['redeemscript'] == rs) {
                  this.ins[index].script = coinjs.script();
                }
                break;
              }
            }
          }
        }

        this.witness = witness_order;
      }
    }
    return true;
  }

  /* sign inputs */
  r.sign = function(wif, sigHashType) {
    var shType = sigHashType || 1;
    for (var i = 0; i < this.ins.length; i++) {
      var d = this.extractScriptKey(i);

      var w2a = coinjs.wif2address(wif);
      var script = coinjs.script();
      var pubkeyHash = script.pubkeyHash(w2a['address']);

      if (((d['type'] == 'scriptpubkey' && d['script'] == Crypto.util.bytesToHex(pubkeyHash.buffer)) || d['type'] == 'empty') && d['signed'] == "false") {
        this.signinput(i, wif, shType);

      } else if (d['type'] == 'hodl' && d['signed'] == "false") {
        this.signhodl(i, wif, shType);

      } else if (d['type'] == 'multisig') {
        this.signmultisig(i, wif, shType);

      } else if (d['type'] == 'segwit') {
        this.signsegwit(i, wif, shType);

      } else {
        // could not sign
      }
    }
    return this.serialize();
  }

  /* serialize a transaction */
  r.serialize = function() {
    var buffer = [];
    buffer = buffer.concat(coinjs.numToBytes(parseInt(this.version), 4));

    if (coinjs.isArray(this.witness)) {
      buffer = buffer.concat([0x00, 0x01]);
    }

    buffer = buffer.concat(coinjs.numToVarInt(this.ins.length));
    for (var i = 0; i < this.ins.length; i++) {
      var txin = this.ins[i];
      buffer = buffer.concat(Crypto.util.hexToBytes(txin.outpoint.hash).reverse());
      buffer = buffer.concat(coinjs.numToBytes(parseInt(txin.outpoint.index), 4));
      var scriptBytes = txin.script.buffer;
      buffer = buffer.concat(coinjs.numToVarInt(scriptBytes.length));
      buffer = buffer.concat(scriptBytes);
      buffer = buffer.concat(coinjs.numToBytes(parseInt(txin.sequence), 4));
    }
    buffer = buffer.concat(coinjs.numToVarInt(this.outs.length));

    for (var i = 0; i < this.outs.length; i++) {
      var txout = this.outs[i];
      buffer = buffer.concat(coinjs.numToBytes(txout.value, 8));
      var scriptBytes = txout.script.buffer;
      buffer = buffer.concat(coinjs.numToVarInt(scriptBytes.length));
      buffer = buffer.concat(scriptBytes);
    }

    if ((coinjs.isArray(this.witness)) && this.witness.length >= 1) {
      for (var i = 0; i < this.witness.length; i++) {
        buffer = buffer.concat(coinjs.numToVarInt(this.witness[i].length));
        for (var x = 0; x < this.witness[i].length; x++) {
          buffer = buffer.concat(coinjs.numToVarInt(Crypto.util.hexToBytes(this.witness[i][x]).length));
          buffer = buffer.concat(Crypto.util.hexToBytes(this.witness[i][x]));
        }
      }
    }

    buffer = buffer.concat(coinjs.numToBytes(parseInt(this.lock_time), 4));
    return Crypto.util.bytesToHex(buffer);
  }

  /* deserialize a transaction */
  /* deserialize a transaction */
  r.deserialize = function(buffer) {
    if (typeof buffer == "string") {
      buffer = Crypto.util.hexToBytes(buffer)
    }

    var pos = 0;
    var witness = false;

    var readAsInt = function(bytes) {
      if (bytes == 0) return 0;
      pos++;
      return buffer[pos - 1] + readAsInt(bytes - 1) * 256;
    }

    var readVarInt = function() {
      pos++;
      if (buffer[pos - 1] < 253) {
        return buffer[pos - 1];
      }
      return readAsInt(buffer[pos - 1] - 251);
    }

    var readBytes = function(bytes) {
      pos += bytes;
      return buffer.slice(pos - bytes, pos);
    }

    var readVarString = function() {
      var size = readVarInt();
      return readBytes(size);
    }

    var obj = new coinjs.transaction();
    obj.version = readAsInt(4);

    if (buffer[pos] == 0x00 && buffer[pos + 1] == 0x01) {
      // segwit transaction
      witness = true;
      obj.witness = [];
      pos += 2;
    }

    var ins = readVarInt();
    for (var i = 0; i < ins; i++) {
      obj.ins.push({
        outpoint: {
          hash: Crypto.util.bytesToHex(readBytes(32).reverse()),
          index: readAsInt(4)
        },
        script: coinjs.script(readVarString()),
        sequence: readAsInt(4)
      });
    }

    var outs = readVarInt();
    for (var i = 0; i < outs; i++) {
      obj.outs.push({
        value: coinjs.bytesToNum(readBytes(8)),
        script: coinjs.script(readVarString())
      });
    }

    if (witness == true) {
      for (i = 0; i < ins; ++i) {
        var count = readVarInt();
        var vector = [];
        for (var y = 0; y < count; y++) {
          var slice = readVarInt();
          pos += slice;
          if (!coinjs.isArray(obj.witness[i])) {
            obj.witness[i] = [];
          }
          obj.witness[i].push(Crypto.util.bytesToHex(buffer.slice(pos - slice, pos)));
        }
      }
    }

    obj.lock_time = readAsInt(4);
    return obj;
  }

  r.size = function() {
    return ((this.serialize()).length / 2).toFixed(0);
  }

  return r;
}

/* start of signature vertification functions */

coinjs.verifySignature = function(hash, sig, pubkey) {

  function parseSig(sig) {
    var cursor;
    if (sig[0] != 0x30)
      throw new Error("Signature not a valid DERSequence");

    cursor = 2;
    if (sig[cursor] != 0x02)
      throw new Error("First element in signature must be a DERInteger");;

    var rBa = sig.slice(cursor + 2, cursor + 2 + sig[cursor + 1]);

    cursor += 2 + sig[cursor + 1];
    if (sig[cursor] != 0x02)
      throw new Error("Second element in signature must be a DERInteger");

    var sBa = sig.slice(cursor + 2, cursor + 2 + sig[cursor + 1]);

    cursor += 2 + sig[cursor + 1];

    var r = BigInteger.fromByteArrayUnsigned(rBa);
    var s = BigInteger.fromByteArrayUnsigned(sBa);

    return {
      r: r,
      s: s
    };
  }

  var r, s;

  if (coinjs.isArray(sig)) {
    var obj = parseSig(sig);
    r = obj.r;
    s = obj.s;
  } else if ("object" === typeof sig && sig.r && sig.s) {
    r = sig.r;
    s = sig.s;
  } else {
    throw "Invalid value for signature";
  }

  var Q;
  if (coinjs.isArray(pubkey)) {
    var ecparams = EllipticCurve.getSECCurveByName("secp256k1");
    Q = EllipticCurve.PointFp.decodeFrom(ecparams.getCurve(), pubkey);
  } else {
    throw "Invalid format for pubkey value, must be byte array";
  }
  var e = BigInteger.fromByteArrayUnsigned(hash);

  return coinjs.verifySignatureRaw(e, r, s, Q);
}

coinjs.verifySignatureRaw = function(e, r, s, Q) {
  var ecparams = EllipticCurve.getSECCurveByName("secp256k1");
  var n = ecparams.getN();
  var G = ecparams.getG();

  if (r.compareTo(BigInteger.ONE) < 0 || r.compareTo(n) >= 0)
    return false;

  if (s.compareTo(BigInteger.ONE) < 0 || s.compareTo(n) >= 0)
    return false;

  var c = s.modInverse(n);

  var u1 = e.multiply(c).mod(n);
  var u2 = r.multiply(c).mod(n);

  var point = G.multiply(u1).add(Q.multiply(u2));

  var v = point.getX().toBigInteger().mod(n);

  return v.equals(r);
}

/* start of privates functions */

/* base58 encode function */
coinjs.base58encode = function(buffer) {
  var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  var base = BigInteger.valueOf(58);

  var bi = BigInteger.fromByteArrayUnsigned(buffer);
  var chars = [];

  while (bi.compareTo(base) >= 0) {
    var mod = bi.mod(base);
    chars.unshift(alphabet[mod.intValue()]);
    bi = bi.subtract(mod).divide(base);
  }

  chars.unshift(alphabet[bi.intValue()]);
  for (var i = 0; i < buffer.length; i++) {
    if (buffer[i] == 0x00) {
      chars.unshift(alphabet[0]);
    } else break;
  }
  return chars.join('');
}

/* base58 decode function */
coinjs.base58decode = function(buffer) {
  var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  var base = BigInteger.valueOf(58);
  var validRegex = /^[1-9A-HJ-NP-Za-km-z]+$/;

  var bi = BigInteger.valueOf(0);
  var leadingZerosNum = 0;
  for (var i = buffer.length - 1; i >= 0; i--) {
    var alphaIndex = alphabet.indexOf(buffer[i]);
    if (alphaIndex < 0) {
      throw "Invalid character";
    }
    bi = bi.add(BigInteger.valueOf(alphaIndex).multiply(base.pow(buffer.length - 1 - i)));

    if (buffer[i] == "1") leadingZerosNum++;
    else leadingZerosNum = 0;
  }

  var bytes = bi.toByteArrayUnsigned();
  while (leadingZerosNum-- > 0) bytes.unshift(0);
  return bytes;
}

/* raw ajax function to avoid needing bigger frame works like jquery, mootools etc */
coinjs.ajax = function(u, f, m, a) {
  var x = false;
  try {
    x = new ActiveXObject('Msxml2.XMLHTTP')
  } catch (e) {
    try {
      x = new ActiveXObject('Microsoft.XMLHTTP')
    } catch (e) {
      x = new XMLHttpRequest()
    }
  }

  if (x == false) {
    return false;
  }

  x.open(m, u, true);
  x.onreadystatechange = function() {
    if ((x.readyState == 4) && f)
      f(x.responseText);
  };

  if (m == 'POST') {
    x.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  }

  x.send(a);
}

/* clone an object */
coinjs.clone = function(obj) {
  if (obj == null || typeof(obj) != 'object') return obj;
  var temp = new obj.constructor();

  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      temp[key] = coinjs.clone(obj[key]);
    }
  }
  return temp;
}

coinjs.numToBytes = function(num, bytes) {
  if (typeof bytes === "undefined") bytes = 8;
  if (bytes == 0) {
    return [];
  } else if (num == -1) {
    return Crypto.util.hexToBytes("ffffffffffffffff");
  } else {
    return [num % 256].concat(coinjs.numToBytes(Math.floor(num / 256), bytes - 1));
  }
}

coinjs.numToByteArray = function(num) {
  if (num <= 256) {
    return [num];
  } else {
    return [num % 256].concat(coinjs.numToByteArray(Math.floor(num / 256)));
  }
}

coinjs.numToVarInt = function(num) {
  if (num < 253) {
    return [num];
  } else if (num < 65536) {
    return [253].concat(coinjs.numToBytes(num, 2));
  } else if (num < 4294967296) {
    return [254].concat(coinjs.numToBytes(num, 4));
  } else {
    return [255].concat(coinjs.numToBytes(num, 8));
  }
}

coinjs.bytesToNum = function(bytes) {
  if (bytes.length == 0) return 0;
  else return bytes[0] + 256 * coinjs.bytesToNum(bytes.slice(1));
}

coinjs.uint = function(f, size) {
  if (f.length < size)
    throw new Error("not enough data");
  var n = 0;
  for (var i = 0; i < size; i++) {
    n *= 256;
    n += f[i];
  }
  return n;
}

coinjs.isArray = function(o) {
  return Object.prototype.toString.call(o) === '[object Array]';
}

coinjs.countObject = function(obj) {
  var count = 0;
  var i;
  for (i in obj) {
    if (obj.hasOwnProperty(i)) {
      count++;
    }
  }
  return count;
}

coinjs.random = function(length) {
  var r = "";
  var l = length || 25;
  var chars = "!$%^&*()_+{}:@~?><|\./;'#][=-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  for (let x = 0; x < l; x++) {
    r += chars.charAt(Math.floor(Math.random() * 62));
  }
  return r;
}

export default coinjs;

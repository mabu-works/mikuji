"use strict";

// ==========================================
// 🧪 おみくじの純ロジックのテスト（node --test）
// ==========================================
// 📌 期待値の一部は旧実装の出力から採取したゴールデン値。
//    決定的乱数の仕様が変わると結果が変わるため、その場合は意図的な
//    仕様変更として DESIGN.md の判断記録に残すこと。

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hashString,
  mulberry32,
  dateString,
  previousDayString,
  FORTUNES,
  LUCKY_ITEMS,
  LUCKY_COLORS,
  HITOKOTO,
  MINI,
  pickFortuneName,
  computeFortune,
  LS_KEYS,
  HISTORY_LIMIT,
  loadHistoryFrom,
  saveHistoryTo,
  nextStreak,
  updateStreakIn,
  recordHistoryIn,
  buildShareText,
  cardFileName,
  wrapText,
} = require("../app.js");

// 🗄️ localStorage の最小限の代替（テスト用）
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map,
  };
}

// ==========================================
// 🎲 決定的乱数
// ==========================================

test("hashString matches the FNV-1a reference values", () => {
  assert.equal(hashString(""), 2166136261); // オフセット基底 0x811c9dc5
  assert.equal(hashString("a"), 3826002220); // 0xe40c292c
  assert.equal(hashString("mikuji|2026-11-28|"), 847403134);
});

test("mulberry32 is deterministic and stays within [0, 1)", () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  assert.deepEqual(seqA, [0.9797282677609473, 0.3067522644996643, 0.484205421525985]);
  const c = mulberry32(999);
  for (let i = 0; i < 1000; i++) {
    const v = c();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

// ==========================================
// 📅 日付
// ==========================================

test("dateString zero-pads month and day", () => {
  assert.equal(dateString(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(dateString(new Date(2026, 10, 28)), "2026-11-28");
  assert.equal(dateString(new Date(2024, 1, 29)), "2024-02-29");
});

test("previousDayString crosses month and year boundaries", () => {
  assert.equal(previousDayString("2026-11-28"), "2026-11-27");
  assert.equal(previousDayString("2026-03-01"), "2026-02-28");
  assert.equal(previousDayString("2024-03-01"), "2024-02-29");
  assert.equal(previousDayString("2026-01-01"), "2025-12-31");
});

// ==========================================
// 📦 データプールの整合性
// ==========================================

test("fortune ranks and weights are exactly the seven defined ranks", () => {
  assert.deepEqual(
    FORTUNES.map((f) => [f.name, f.weight]),
    [
      ["大吉", 10],
      ["中吉", 18],
      ["小吉", 18],
      ["吉", 22],
      ["末吉", 14],
      ["凶", 12],
      ["大凶", 6],
    ]
  );
  assert.equal(FORTUNES.reduce((s, f) => s + f.weight, 0), 100);
});

test("content pools have the expected sizes and no duplicates", () => {
  assert.equal(LUCKY_ITEMS.length, 20);
  assert.equal(new Set(LUCKY_ITEMS).size, 20);
  assert.equal(LUCKY_COLORS.length, 12);
  assert.equal(new Set(LUCKY_COLORS.map((c) => c.name)).size, 12);
  for (const c of LUCKY_COLORS) assert.match(c.hex, /^#[0-9a-f]{6}$/);
  assert.equal(HITOKOTO.length, 16);
  assert.equal(new Set(HITOKOTO).size, 16);
  for (const key of ["wish", "work", "love"]) {
    assert.equal(MINI[key].length, 6, key);
    assert.equal(new Set(MINI[key]).size, 6, key);
  }
});

// ==========================================
// 🍀 運勢の決定
// ==========================================

test("pickFortuneName respects the weight boundaries", () => {
  // 重み累積: 大吉 <10, 中吉 <28, 小吉 <46, 吉 <68, 末吉 <82, 凶 <94, 大凶 <100
  const at = (v) => pickFortuneName(() => v);
  assert.equal(at(0), "大吉");
  assert.equal(at(0.0999), "大吉");
  assert.equal(at(0.1), "中吉");
  assert.equal(at(0.28), "小吉");
  assert.equal(at(0.46), "吉");
  assert.equal(at(0.68), "末吉");
  assert.equal(at(0.82), "凶");
  assert.equal(at(0.94), "大凶");
  assert.equal(at(0.9999), "大凶");
});

test("computeFortune reproduces the golden results of the previous implementation", () => {
  assert.deepEqual(computeFortune("", "2026-11-28"), {
    date: "2026-11-28",
    name: "",
    fortune: "小吉",
    item: "鍵",
    color: { name: "青", hex: "#2563eb" },
    hitokoto: "今日は聞き役が一番の功労者です。",
    wish: "願いは小さく刻むと叶いやすい日。一段ずつ進めてみて。",
    work: "コツコツ型が勝つ日。地道な作業ほど評価されます。",
    love: "聞き上手が魅力になる日。相手の話に相づちを多めに。",
  });
  assert.deepEqual(computeFortune("まぶ", "2026-11-28"), {
    date: "2026-11-28",
    name: "まぶ",
    fortune: "中吉",
    item: "スマホの待受を変えること",
    color: { name: "ピンク", hex: "#ec4899" },
    hitokoto: "焦らず一歩ずつ。今日の積み重ねが明日を作ります。",
    wish: "今日は願いを口に出すのが吉。信頼できる人に話してみましょう。",
    work: "丁寧な確認がミスを防ぎます。急がば回れが合言葉。",
    love: "共通の趣味の話が盛り上がる日。話題の種を持っておきましょう。",
  });
  assert.equal(computeFortune("太郎", "2025-12-31").fortune, "大吉");
  assert.equal(computeFortune("", "2026-01-01").fortune, "凶");
  assert.equal(computeFortune("", "2024-02-29").fortune, "凶");
  assert.equal(computeFortune("a", "2030-06-15").fortune, "末吉");
});

test("computeFortune is deterministic and every field comes from its pool", () => {
  for (const [name, date] of [["", "2026-11-28"], ["誰か", "2027-05-03"], ["x", "2025-02-14"]]) {
    const r1 = computeFortune(name, date);
    const r2 = computeFortune(name, date);
    assert.deepEqual(r1, r2);
    assert.ok(FORTUNES.some((f) => f.name === r1.fortune));
    assert.ok(LUCKY_ITEMS.includes(r1.item));
    assert.ok(LUCKY_COLORS.some((c) => c.name === r1.color.name && c.hex === r1.color.hex));
    assert.ok(HITOKOTO.includes(r1.hitokoto));
    assert.ok(MINI.wish.includes(r1.wish));
    assert.ok(MINI.work.includes(r1.work));
    assert.ok(MINI.love.includes(r1.love));
  }
});

test("rank distribution over 3650 days matches the golden counts", () => {
  const counts = {};
  for (let i = 0; i < 3650; i++) {
    const d = new Date(2020, 0, 1 + i);
    const f = computeFortune("", dateString(d)).fortune;
    counts[f] = (counts[f] || 0) + 1;
  }
  assert.deepEqual(counts, {
    "大吉": 387,
    "中吉": 624,
    "小吉": 644,
    "吉": 784,
    "末吉": 513,
    "凶": 452,
    "大凶": 246,
  });
});

// ==========================================
// 🔥 ストリーク
// ==========================================

test("nextStreak implements the visit rules", () => {
  const today = "2026-11-28";
  const yesterday = "2026-11-27";
  assert.equal(nextStreak(null, 0, today, yesterday), 1); // 初回訪問
  assert.equal(nextStreak(today, 5, today, yesterday), 5); // 同日は維持
  assert.equal(nextStreak(today, 0, today, yesterday), 1); // 同日で保存値0なら1
  assert.equal(nextStreak(yesterday, 5, today, yesterday), 6); // 昨日なら+1
  assert.equal(nextStreak("2026-11-20", 5, today, yesterday), 1); // 間が空けばリセット
});

test("updateStreakIn persists last visit and streak under the legacy keys", () => {
  const storage = fakeStorage();
  assert.equal(updateStreakIn(storage, "2026-11-28", "2026-11-27"), 1);
  assert.equal(storage.getItem(LS_KEYS.lastVisit), "2026-11-28");
  assert.equal(storage.getItem(LS_KEYS.streak), "1");
  // 同じ日の再訪では維持され、上書きもされない
  assert.equal(updateStreakIn(storage, "2026-11-28", "2026-11-27"), 1);
  // 翌日は+1
  assert.equal(updateStreakIn(storage, "2026-11-29", "2026-11-28"), 2);
  assert.equal(storage.getItem(LS_KEYS.streak), "2");
  // 2日空けるとリセット
  assert.equal(updateStreakIn(storage, "2026-12-02", "2026-12-01"), 1);
});

test("updateStreakIn keeps a stored same-day streak as-is", () => {
  const storage = fakeStorage({
    [LS_KEYS.lastVisit]: "2026-11-28",
    [LS_KEYS.streak]: "7",
  });
  assert.equal(updateStreakIn(storage, "2026-11-28", "2026-11-27"), 7);
});

// ==========================================
// 📜 履歴
// ==========================================

test("history is stored under the legacy key in the legacy shape", () => {
  assert.equal(LS_KEYS.history, "mikuji_history");
  assert.equal(LS_KEYS.lastVisit, "mikuji_last_visit");
  assert.equal(LS_KEYS.streak, "mikuji_streak");
  const storage = fakeStorage();
  const result = computeFortune("まぶ", "2026-11-28");
  const history = recordHistoryIn(storage, result);
  assert.equal(history.length, 1);
  assert.deepEqual(history[0], { date: "2026-11-28", fortune: "中吉", name: "まぶ" });
  assert.deepEqual(JSON.parse(storage.getItem(LS_KEYS.history)), history);
});

test("recordHistoryIn does not duplicate the same date and keeps newest first", () => {
  const storage = fakeStorage();
  recordHistoryIn(storage, { date: "2026-11-27", fortune: "吉", name: "" });
  recordHistoryIn(storage, { date: "2026-11-28", fortune: "大吉", name: "" });
  const history = recordHistoryIn(storage, { date: "2026-11-28", fortune: "凶", name: "別" });
  assert.equal(history.length, 2);
  assert.equal(history[0].date, "2026-11-28");
  assert.equal(history[0].fortune, "大吉"); // 先に記録された方が残る
  assert.equal(history[1].date, "2026-11-27");
});

test("history is capped at 30 entries", () => {
  const storage = fakeStorage();
  for (let i = 0; i < 35; i++) {
    const d = dateString(new Date(2026, 0, 1 + i));
    recordHistoryIn(storage, { date: d, fortune: "吉", name: "" });
  }
  const history = loadHistoryFrom(storage);
  assert.equal(HISTORY_LIMIT, 30);
  assert.equal(history.length, 30);
  assert.equal(history[0].date, "2026-02-04");
  assert.equal(history[29].date, "2026-01-06");
});

test("loadHistoryFrom tolerates broken or non-array data", () => {
  assert.deepEqual(loadHistoryFrom(fakeStorage()), []);
  assert.deepEqual(loadHistoryFrom(fakeStorage({ [LS_KEYS.history]: "{broken" })), []);
  assert.deepEqual(loadHistoryFrom(fakeStorage({ [LS_KEYS.history]: '{"a":1}' })), []);
  assert.deepEqual(loadHistoryFrom(fakeStorage({ [LS_KEYS.history]: "null" })), []);
});

test("saveHistoryTo slices to the limit before writing", () => {
  const storage = fakeStorage();
  const arr = Array.from({ length: 40 }, (_, i) => ({ date: `d${i}`, fortune: "吉", name: "" }));
  saveHistoryTo(storage, arr);
  assert.equal(JSON.parse(storage.getItem(LS_KEYS.history)).length, 30);
});

// ==========================================
// 🔗 共有・折り返し
// ==========================================

test("buildShareText matches the shared post format", () => {
  const result = computeFortune("", "2026-11-28");
  assert.equal(
    buildShareText(result),
    "2026-11-28 の運勢は「小吉」でした！ ラッキーアイテムは鍵。 #おみくじ"
  );
});

test("cardFileName embeds the date", () => {
  assert.equal(cardFileName("2026-11-28"), "mikuji-2026-11-28.png");
});

test("wrapText wraps by measured width per paragraph", () => {
  const measure = (t) => t.length * 10; // 1文字10pxの等幅として計測
  assert.deepEqual(wrapText(measure, "あいうえお", 30), ["あいう", "えお"]);
  assert.deepEqual(wrapText(measure, "あい\nうえお", 30), ["あい", "うえお"]); // ちょうど30pxは折らない
  assert.deepEqual(wrapText(measure, "あい\nうえお", 20), ["あい", "うえ", "お"]);
  assert.deepEqual(wrapText(measure, "", 30), [""]);
  assert.deepEqual(wrapText(measure, "ab", 30), ["ab"]);
});

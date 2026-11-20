"use strict";

// ===== 決定的乱数（シード付き） =====
function hashString(str) {
let h = 0x811c9dc5;
for (let i = 0; i < str.length; i++) {
h ^= str.charCodeAt(i);
h = Math.imul(h, 0x01000193);
}
return h >>> 0;
}

function mulberry32(seed) {
let a = seed >>> 0;
return function () {
a = (a + 0x6d2b79f5) | 0;
let t = Math.imul(a ^ (a >>> 15), 1 | a);
t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}

function dateString(d) {
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
return `${y}-${m}-${day}`;
}
function todayString() {
return dateString(new Date());
}

// ===== データ =====
// 運勢7段階（重み付きで抽選）
const FORTUNES = [
{ name: "大吉", weight: 10},
{ name: "中吉", weight: 18},
{ name: "小吉", weight: 18},
{ name: "吉", weight: 22},
{ name: "末吉", weight: 14},
{ name: "凶", weight: 12},
{ name: "大凶", weight: 6},
];

const LUCKY_ITEMS = [
"ハンカチ", "青いペン", "本のしおり", "イヤホン", "腕時計", "鍵",
"コンビニの新作スイーツ", "温かい飲み物", "折りたたみ傘", "ミントタブレット",
"スマホの待受を変えること", "いつもの定期入れ", "白い靴下", "メモ帳",
"音楽プレイリスト", "観葉植物", "駅の売店のお菓子", "新しい靴ひも",
"手紙", "季節の花",
];

const LUCKY_COLORS = [
{ name: "赤", hex: "#dc2626"},
{ name: "青", hex: "#2563eb"},
{ name: "緑", hex: "#16a34a"},
{ name: "黄色", hex: "#eab308"},
{ name: "紫", hex: "#9333ea"},
{ name: "ピンク", hex: "#ec4899"},
{ name: "白", hex: "#f8fafc"},
{ name: "黒", hex: "#171717"},
{ name: "水色", hex: "#38bdf8"},
{ name: "オレンジ", hex: "#f97316"},
{ name: "金色", hex: "#d4a017"},
{ name: "若草色", hex: "#84cc16"},
];

const HITOKOTO = [
"焦らず一歩ずつ。今日の積み重ねが明日を作ります。",
"笑顔は最強のお守り。まず自分から笑ってみましょう。",
"迷ったら、ワクワクする方を選んで正解です。",
"小さな親切が大きな幸運を連れてきます。",
"深呼吸ひとつで、流れは変えられます。",
"今日の失敗は、明日のネタになります。",
"「ありがとう」を言える回数が、今日の運の量です。",
"やらない後悔より、やってみる勇気を。",
"丁寧にやることが、いちばんの近道です。",
"休むことも大事な予定のひとつです。",
"気になっていた連絡は、今日返すと吉。",
"整理整頓から運は巡り始めます。",
"新しいことに触れると視界が広がります。",
"人の話を最後まで聞くと、良い知らせが入ります。",
"今日は聞き役が一番の功労者です。",
"背筋を伸ばすだけで気分は上向きます。",
];

// ミニ運勢（カテゴリ別・複数パターンから決定的に選択）
const MINI = {
wish: [
"願いは近づいています。具体的に言葉にすると叶いやすくなります。",
"願い事は焦らず温める時期。準備を進めるほど実ります。",
"思いがけない形で願いが動く兆し。アンテナを張っておきましょう。",
"願いは小さく刻むと叶いやすい日。一段ずつ進めてみて。",
"今日は願いを口に出すのが吉。信頼できる人に話してみましょう。",
"願い事は保留が正解の日。タイミングは必ず来ます。",
],
work: [
"集中力が冴える日。難しい課題から先に片付けると好調です。",
"丁寧な確認がミスを防ぎます。急がば回れが合言葉。",
"新しいやり方を試すと発見がある日。メモを忘れずに。",
"周りとの連携が成果を生む日。報連相を少し丁寧に。",
"コツコツ型が勝つ日。地道な作業ほど評価されます。",
"詰まったら場所を変えてみて。気分転換が突破口になります。",
],
love: [
"素直な一言が距離を縮める日。照れずに伝えてみましょう。",
"聞き上手が魅力になる日。相手の話に相づちを多めに。",
"思いがけない再会や連絡の兆し。返信は早めが吉。",
"焦らず自然体でいることが一番の近道です。",
"共通の趣味の話が盛り上がる日。話題の種を持っておきましょう。",
"今日は自分磨きの日。魅力を蓄える時間にしましょう。",
],
};

// ===== 運勢の決定 =====
function computeFortune(name, dateStr) {
const seed = hashString(`mikuji|${dateStr}|${name || ""}`);
const rand = mulberry32(seed);

const totalWeight = FORTUNES.reduce((s, f) => s + f.weight, 0);
let r = rand() * totalWeight;
let fortune = FORTUNES[FORTUNES.length - 1].name;
for (const f of FORTUNES) {
r -= f.weight;
if (r < 0) { fortune = f.name; break;}
}

const pick = (arr) => arr[Math.floor(rand() * arr.length)];
return {
date: dateStr,
name: name || "",
fortune,
item: pick(LUCKY_ITEMS),
color: pick(LUCKY_COLORS),
hitokoto: pick(HITOKOTO),
wish: pick(MINI.wish),
work: pick(MINI.work),
love: pick(MINI.love),
};
}

// ===== localStorage（ストリーク・履歴） =====
const LS_KEYS = {
lastVisit: "mikuji_last_visit",
streak: "mikuji_streak",
history: "mikuji_history",
};

function loadHistory() {
try {
const raw = localStorage.getItem(LS_KEYS.history);
const arr = raw? JSON.parse(raw): [];
return Array.isArray(arr)? arr: [];
} catch {
return [];
}
}

function saveHistory(arr) {
try {
localStorage.setItem(LS_KEYS.history, JSON.stringify(arr.slice(0, 30)));
} catch { /* 保存できない環境では無視 */}
}

// 訪問ストリークを更新して現在の連続日数を返す
function updateStreak() {
const today = todayString();
let last = null;
let streak = 0;
try {
last = localStorage.getItem(LS_KEYS.lastVisit);
streak = parseInt(localStorage.getItem(LS_KEYS.streak) || "0", 10) || 0;
} catch { /* ignore */}

if (last === today) {
return streak || 1;
}
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
streak = last === dateString(yesterday)? streak + 1: 1;
try {
localStorage.setItem(LS_KEYS.lastVisit, today);
localStorage.setItem(LS_KEYS.streak, String(streak));
} catch { /* ignore */}
return streak;
}

function recordHistory(result) {
const history = loadHistory();
if (!history.some((h) => h.date === result.date)) {
// 名前も保存する：結果は「日付＋名前」から決定的に決まるため、
// 開き直したときに引いた時点の結果をそのまま再現できる
history.unshift({ date: result.date, fortune: result.fortune, name: result.name});
saveHistory(history);
}
return loadHistory();
}

// ===== UI =====
const nameInput = document.getElementById("nameInput");
const drawBtn = document.getElementById("drawBtn");
const mikujiBox = document.getElementById("mikujiBox");
const drawnNote = document.getElementById("drawnNote");
const streakText = document.getElementById("streakText");
const resultCard = document.getElementById("resultCard");
const resultDate = document.getElementById("resultDate");
const fortuneText = document.getElementById("fortuneText");
const resultFor = document.getElementById("resultFor");
const hitokotoText = document.getElementById("hitokotoText");
const luckyItem = document.getElementById("luckyItem");
const luckyColor = document.getElementById("luckyColor");
const colorDot = document.getElementById("colorDot");
const miniWish = document.getElementById("miniWish");
const miniWork = document.getElementById("miniWork");
const miniLove = document.getElementById("miniLove");
const downloadBtn = document.getElementById("downloadBtn");
const shareLink = document.getElementById("shareLink");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const canvas = document.getElementById("cardCanvas");

let currentResult = null;

const streak = updateStreak();
streakText.textContent = streak > 1
? `🔥 ${streak}日連続で訪問中！`
: "今日も来てくれてありがとうございます";

function renderHistory() {
const history = loadHistory();
historyList.innerHTML = "";
historyEmpty.hidden = history.length > 0;
for (const h of history) {
const li = document.createElement("li");
const d = document.createElement("span");
d.textContent = h.date;
const f = document.createElement("span");
f.className = "h-fortune";
f.textContent = h.fortune;
li.appendChild(d);
li.appendChild(f);
historyList.appendChild(li);
}
}

function showResult(result) {
currentResult = result;
resultDate.textContent = `${result.date} の運勢`;
fortuneText.textContent = result.fortune;
resultFor.textContent = result.name? `${result.name} さんの運勢`: "";
resultFor.hidden =!result.name;
hitokotoText.textContent = result.hitokoto;
luckyItem.textContent = result.item;
luckyColor.textContent = result.color.name;
colorDot.style.background = result.color.hex;
miniWish.textContent = result.wish;
miniWork.textContent = result.work;
miniLove.textContent = result.love;

const shareText = `${result.date} の運勢は「${result.fortune}」でした！ ラッキーアイテムは${result.item}。 #おみくじ`;
shareLink.href =
"https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText);

resultCard.hidden = false;
}

// 今日すでに引いている場合は、開いた時点で結果を表示する
// 復元は履歴に保存した名前で再計算する（空の名前欄で再計算すると、
// 名前を入れて引いた人では履歴と違う結果が表示されてしまうため）
(function initToday() {
const history = loadHistory();
const todayEntry = history.find((h) => h.date === todayString());
if (todayEntry) {
drawnNote.hidden = false;
showResult(computeFortune(todayEntry.name || "", todayString()));
}
renderHistory();
})();

drawBtn.addEventListener("click", () => {
if (drawBtn.disabled) return;
drawBtn.disabled = true;
mikujiBox.classList.add("shaking");
setTimeout(() => {
mikujiBox.classList.remove("shaking");
drawBtn.disabled = false;
const result = computeFortune(nameInput.value.trim(), todayString());
recordHistory(result);
drawnNote.hidden = false;
showResult(result);
renderHistory();
resultCard.scrollIntoView({ behavior: "smooth", block: "start"});
}, 1200);
});

// ===== 結果カード（Canvas 1200×630） =====
function wrapText(ctx, text, maxWidth) {
const lines = [];
for (const paragraph of text.split("\n")) {
let line = "";
for (const ch of paragraph) {
const test = line + ch;
if (ctx.measureText(test).width > maxWidth && line.length > 0) {
lines.push(line);
line = ch;
} else {
line = test;
}
}
lines.push(line);
}
return lines;
}

function drawCard() {
if (!currentResult) return;
const r = currentResult;
const ctx = canvas.getContext("2d");
const W = 1200, H = 630;

const grad = ctx.createLinearGradient(0, 0, W, H);
grad.addColorStop(0, "#b91c1c");
grad.addColorStop(1, "#7f1d1d");
ctx.fillStyle = grad;
ctx.fillRect(0, 0, W, H);

ctx.fillStyle = "#fffbeb";
ctx.fillRect(60, 60, W - 120, H - 120);

ctx.textAlign = "center";
ctx.fillStyle = "#7a6a58";
ctx.font = "28px sans-serif";
ctx.fillText(`${r.date} の運勢${r.name? ` ・ ${r.name} さん`: ""}`, W / 2, 140);

ctx.fillStyle = "#b91c1c";
ctx.font = "bold 130px sans-serif";
ctx.fillText(r.fortune, W / 2, 285);

ctx.fillStyle = "#2b2118";
ctx.font = "bold 30px sans-serif";
const lines = wrapText(ctx, r.hitokoto, W - 240);
lines.slice(0, 2).forEach((line, i) => {
ctx.fillText(line, W / 2, 360 + i * 44);
});

ctx.font = "28px sans-serif";
ctx.fillStyle = "#333333";
ctx.fillText(`ラッキーアイテム：${r.item}　／　ラッキーカラー：${r.color.name}`, W / 2, 480);

ctx.fillStyle = "#8a7a68";
ctx.font = "22px sans-serif";
ctx.fillText("おみくじ ・ 今日の運勢", W / 2, H - 85);
}

downloadBtn.addEventListener("click", () => {
if (!currentResult) return;
drawCard();
const a = document.createElement("a");
a.download = `mikuji-${todayString()}.png`;
a.href = canvas.toDataURL("image/png");
a.click();
});

// ===== テーマ切り替え（ダーク既定／ライト） =====
(function initTheme() {
var root = document.documentElement;
if (!root || !root.getAttribute || !root.setAttribute) return;
function apply(theme) {
root.setAttribute("data-theme", theme);
var btn = document.getElementById("themeToggle");
if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
}
var current = root.getAttribute("data-theme");
if (current !== "light" && current !== "dark") {
try { current = localStorage.getItem("mikuji-theme"); } catch { current = null; }
}
apply(current === "light" ? "light" : "dark");
var btn = document.getElementById("themeToggle");
if (btn && btn.addEventListener) {
btn.addEventListener("click", function () {
var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
apply(next);
try { localStorage.setItem("mikuji-theme", next); } catch { /* 保存できなくても切り替え自体は有効 */ }
});
}
})();

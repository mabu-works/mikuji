using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Windows.Forms;

namespace Mikuji
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new MainForm());
        }
    }

    // ==========================================
    // 🎲 決定的乱数（Web版と同一仕様）
    // ==========================================

    // 📝 文字列の FNV-1a ハッシュ（32bit）を求める
    internal static class FortuneRandom
    {
        public static uint HashString(string str)
        {
            uint h = 0x811c9dc5u;
            foreach (char c in str)
            {
                h ^= c;
                h = unchecked(h * 0x01000193u);
            }
            return h;
        }
    }

    // 🎲 シードから決定的な乱数列を作る（mulberry32）
    internal sealed class Mulberry32
    {
        private uint _a;

        public Mulberry32(uint seed)
        {
            _a = seed;
        }

        // 🎲 次の乱数（0以上1未満）を返す
        public double Next()
        {
            _a = unchecked(_a + 0x6d2b79f5u);
            uint t = unchecked((_a ^ (_a >> 15)) * (1u | _a));
            t = unchecked((t + unchecked((t ^ (t >> 7)) * (61u | t))) ^ t);
            return (t ^ (t >> 14)) / 4294967296.0;
        }
    }

    // ==========================================
    // 💾 保存データの形（Web版 localStorage と同じ内容）
    // ==========================================

    // 📜 履歴1件分（日付・運勢・名前）
    internal sealed class HistoryEntry
    {
        public string Date { get; set; } = "";
        public string Fortune { get; set; } = "";
        public string Name { get; set; } = "";
    }

    // 💾 保存データ全体（最終訪問日・連続日数・履歴）
    internal sealed class SaveData
    {
        public string? LastVisit { get; set; }
        public int Streak { get; set; }
        public List<HistoryEntry> History { get; set; } = new List<HistoryEntry>();
    }

    // 🍀 運勢の計算結果
    internal sealed class FortuneResult
    {
        public string Date = "";
        public string Name = "";
        public string Fortune = "";
        public string Item = "";
        public string ColorName = "";
        public Color ColorValue;
        public string Hitokoto = "";
        public string Wish = "";
        public string Work = "";
        public string Love = "";
    }

    internal sealed class MainForm : Form
    {
        // ==========================================
        // 📦 運勢データ（Web版と同一）
        // ==========================================

        // 🎯 運勢7段階（重み付き抽選。重みの合計は100）
        private static readonly (string Name, int Weight)[] Fortunes =
        {
            ("大吉", 10), ("中吉", 18), ("小吉", 18), ("吉", 22),
            ("末吉", 14), ("凶", 12), ("大凶", 6),
        };

        // 🎒 ラッキーアイテム（20種）
        private static readonly string[] LuckyItems =
        {
            "ハンカチ", "青いペン", "本のしおり", "イヤホン", "腕時計", "鍵",
            "コンビニの新作スイーツ", "温かい飲み物", "折りたたみ傘", "ミントタブレット",
            "スマホの待受を変えること", "いつもの定期入れ", "白い靴下", "メモ帳",
            "音楽プレイリスト", "観葉植物", "駅の売店のお菓子", "新しい靴ひも",
            "手紙", "季節の花",
        };

        // 🎨 ラッキーカラー（12種）
        private static readonly (string Name, string Hex)[] LuckyColors =
        {
            ("赤", "#dc2626"), ("青", "#2563eb"), ("緑", "#16a34a"), ("黄色", "#eab308"),
            ("紫", "#9333ea"), ("ピンク", "#ec4899"), ("白", "#f8fafc"), ("黒", "#171717"),
            ("水色", "#38bdf8"), ("オレンジ", "#f97316"), ("金色", "#d4a017"), ("若草色", "#84cc16"),
        };

        // 💬 今日の一言（16種）
        private static readonly string[] HitokotoList =
        {
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
        };

        // 🔮 ミニ運勢: 願い事（6種）
        private static readonly string[] MiniWish =
        {
            "願いは近づいています。具体的に言葉にすると叶いやすくなります。",
            "願い事は焦らず温める時期。準備を進めるほど実ります。",
            "思いがけない形で願いが動く兆し。アンテナを張っておきましょう。",
            "願いは小さく刻むと叶いやすい日。一段ずつ進めてみて。",
            "今日は願いを口に出すのが吉。信頼できる人に話してみましょう。",
            "願い事は保留が正解の日。タイミングは必ず来ます。",
        };

        // 🔮 ミニ運勢: 学業・仕事（6種）
        private static readonly string[] MiniWork =
        {
            "集中力が冴える日。難しい課題から先に片付けると好調です。",
            "丁寧な確認がミスを防ぎます。急がば回れが合言葉。",
            "新しいやり方を試すと発見がある日。メモを忘れずに。",
            "周りとの連携が成果を生む日。報連相を少し丁寧に。",
            "コツコツ型が勝つ日。地道な作業ほど評価されます。",
            "詰まったら場所を変えてみて。気分転換が突破口になります。",
        };

        // 🔮 ミニ運勢: 恋愛（6種）
        private static readonly string[] MiniLove =
        {
            "素直な一言が距離を縮める日。照れずに伝えてみましょう。",
            "聞き上手が魅力になる日。相手の話に相づちを多めに。",
            "思いがけない再会や連絡の兆し。返信は早めが吉。",
            "焦らず自然体でいることが一番の近道です。",
            "共通の趣味の話が盛り上がる日。話題の種を持っておきましょう。",
            "今日は自分磨きの日。魅力を蓄える時間にしましょう。",
        };

        // 🎨 画面の配色（Web版ダークテーマに合わせる）
        private static readonly Color Bg = Color.FromArgb(10, 15, 28);
        private static readonly Color Surface = Color.FromArgb(17, 26, 46);
        private static readonly Color TextColor = Color.FromArgb(236, 241, 248);
        private static readonly Color Muted = Color.FromArgb(157, 177, 199);
        private static readonly Color Accent = Color.FromArgb(106, 141, 255);
        private static readonly Color Accent2 = Color.FromArgb(45, 212, 191);
        private static readonly Color Gold = Color.FromArgb(251, 191, 36);

        private readonly TextBox nameBox;
        private readonly Label streakLabel;
        private readonly Label drawnNote;
        private readonly Panel resultPanel;
        private readonly Label resultDate;
        private readonly Label fortuneLabel;
        private readonly Label resultFor;
        private readonly Label hitokotoLabel;
        private readonly Label itemValue;
        private readonly Panel colorDot;
        private readonly Label colorValue;
        private readonly Label miniWishText;
        private readonly Label miniWorkText;
        private readonly Label miniLoveText;
        private readonly ListBox historyList;
        private readonly Label historyEmpty;

        private SaveData _data = new SaveData();

        // ==========================================
        // 🖥️ 画面の組み立て
        // ==========================================
        public MainForm()
        {
            Text = "おみくじ for Windows｜今日の運勢";
            ClientSize = new Size(560, 860);
            MinimumSize = new Size(576, 899);
            BackColor = Bg;
            ForeColor = TextColor;
            Font = new Font("Yu Gothic UI", 10F);

            var title = new Label
            {
                Text = "おみくじ｜今日の運勢",
                Font = new Font("Yu Gothic UI", 16F, FontStyle.Bold),
                ForeColor = TextColor,
                Location = new Point(20, 14),
                AutoSize = true
            };
            Controls.Add(title);

            streakLabel = new Label
            {
                Text = "",
                ForeColor = Gold,
                Font = new Font("Yu Gothic UI", 10F, FontStyle.Bold),
                Location = new Point(20, 54),
                AutoSize = true
            };
            Controls.Add(streakLabel);

            var nameLabel = new Label
            {
                Text = "名前（任意）",
                ForeColor = Muted,
                Location = new Point(20, 86),
                AutoSize = true
            };
            Controls.Add(nameLabel);

            nameBox = new TextBox
            {
                Location = new Point(20, 112),
                Width = 520,
                MaxLength = 20,
                BackColor = Surface,
                ForeColor = TextColor,
                BorderStyle = BorderStyle.FixedSingle
            };
            Controls.Add(nameBox);

            var drawBtn = new Button
            {
                Text = "おみくじを引く",
                Font = new Font("Yu Gothic UI", 12F, FontStyle.Bold),
                BackColor = Accent,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(20, 152),
                Size = new Size(520, 44)
            };
            drawBtn.FlatAppearance.BorderSize = 0;
            drawBtn.Click += (s, e) => Draw();
            Controls.Add(drawBtn);

            drawnNote = new Label
            {
                Text = "今日はもう引いています。結果は下のとおりです。",
                ForeColor = Muted,
                Location = new Point(20, 204),
                AutoSize = true,
                Visible = false
            };
            Controls.Add(drawnNote);

            resultPanel = new Panel
            {
                Location = new Point(20, 232),
                Size = new Size(520, 436),
                BackColor = Surface,
                Visible = false
            };
            Controls.Add(resultPanel);

            resultDate = CenterLabel("", 10, Muted, 10F, FontStyle.Regular);
            resultPanel.Controls.Add(resultDate);
            fortuneLabel = CenterLabel("", 36, Accent, 44F, FontStyle.Bold);
            fortuneLabel.Height = 92;
            resultPanel.Controls.Add(fortuneLabel);
            resultFor = CenterLabel("", 132, Muted, 10F, FontStyle.Regular);
            resultPanel.Controls.Add(resultFor);
            hitokotoLabel = new Label
            {
                Text = "",
                ForeColor = TextColor,
                Font = new Font("Yu Gothic UI", 11F, FontStyle.Bold),
                Location = new Point(16, 160),
                Size = new Size(488, 52),
                TextAlign = ContentAlignment.MiddleCenter
            };
            resultPanel.Controls.Add(hitokotoLabel);

            var itemHead = SubHead("ラッキーアイテム", 16, 224);
            resultPanel.Controls.Add(itemHead);
            itemValue = new Label
            {
                Text = "",
                ForeColor = TextColor,
                Font = new Font("Yu Gothic UI", 10F, FontStyle.Bold),
                Location = new Point(16, 246),
                AutoSize = true
            };
            resultPanel.Controls.Add(itemValue);

            var colorHead = SubHead("ラッキーカラー", 280, 224);
            resultPanel.Controls.Add(colorHead);
            colorDot = new Panel
            {
                Location = new Point(280, 248),
                Size = new Size(16, 16),
                BackColor = Color.Transparent
            };
            resultPanel.Controls.Add(colorDot);
            colorValue = new Label
            {
                Text = "",
                ForeColor = TextColor,
                Font = new Font("Yu Gothic UI", 10F, FontStyle.Bold),
                Location = new Point(304, 244),
                AutoSize = true
            };
            resultPanel.Controls.Add(colorValue);

            AddMini(resultPanel, "願い事", 284, out Label wishText);
            miniWishText = wishText;
            AddMini(resultPanel, "学業・仕事", 336, out Label workText);
            miniWorkText = workText;
            AddMini(resultPanel, "恋愛", 388, out Label loveText);
            miniLoveText = loveText;

            var historyTitle = new Label
            {
                Text = "引いた履歴",
                Font = new Font("Yu Gothic UI", 12F, FontStyle.Bold),
                ForeColor = TextColor,
                Location = new Point(20, 684),
                AutoSize = true
            };
            Controls.Add(historyTitle);

            historyEmpty = new Label
            {
                Text = "まだ履歴がありません。",
                ForeColor = Muted,
                Location = new Point(20, 716),
                AutoSize = true
            };
            Controls.Add(historyEmpty);

            historyList = new ListBox
            {
                Location = new Point(20, 714),
                Size = new Size(520, 128),
                BackColor = Surface,
                ForeColor = TextColor,
                BorderStyle = BorderStyle.FixedSingle
            };
            Controls.Add(historyList);

            // 💾 保存データを読み、ストリークと履歴を反映する
            LoadData();
            int streak = UpdateStreak();
            streakLabel.Text = streak > 1
                ? $"🔥 {streak}日連続で訪問中！"
                : "今日も来てくれてありがとうございます";
            RenderHistory();

            // 🕘 今日すでに引いている場合は、開いた時点で結果を表示する（Web版と同じ）
            var today = TodayString();
            var todayEntry = _data.History.Find(h => h.Date == today);
            if (todayEntry != null)
            {
                drawnNote.Visible = true;
                ShowResult(ComputeFortune(todayEntry.Name ?? "", today));
            }
        }

        // 🏷️ 中央寄せのラベルを作る
        private Label CenterLabel(string text, int y, Color color, float size, FontStyle style)
        {
            return new Label
            {
                Text = text,
                ForeColor = color,
                Font = new Font("Yu Gothic UI", size, style),
                Location = new Point(0, y),
                Size = new Size(520, 30),
                TextAlign = ContentAlignment.MiddleCenter
            };
        }

        // 🏷️ 小見出しのラベルを作る
        private Label SubHead(string text, int x, int y)
        {
            return new Label
            {
                Text = text,
                ForeColor = Muted,
                Font = new Font("Yu Gothic UI", 9F),
                Location = new Point(x, y),
                AutoSize = true
            };
        }

        // 🔮 ミニ運勢の見出しと本文ラベルを追加する
        private void AddMini(Panel panel, string head, int y, out Label textLabel)
        {
            var h = new Label
            {
                Text = head,
                ForeColor = Accent2,
                Font = new Font("Yu Gothic UI", 9F, FontStyle.Bold),
                Location = new Point(16, y),
                AutoSize = true
            };
            panel.Controls.Add(h);
            textLabel = new Label
            {
                Text = "",
                ForeColor = TextColor,
                Font = new Font("Yu Gothic UI", 9.5F),
                Location = new Point(16, y + 20),
                Size = new Size(488, 30)
            };
            panel.Controls.Add(textLabel);
        }

        // ==========================================
        // 🍀 運勢の計算（Web版 computeFortune と同じ）
        // ==========================================

        // 📅 日付を YYYY-MM-DD 形式の文字列にする
        private static string DateString(DateTime d) => d.ToString("yyyy-MM-dd");

        // 📅 今日の日付を YYYY-MM-DD 形式で返す
        private static string TodayString() => DateString(DateTime.Now);

        // 🍀 名前と日付から今日の運勢を決定的に決める
        // 🔁 乱数の消費順は Web版と同じ: 運勢 → アイテム → カラー → 一言 → 願い事 → 学業・仕事 → 恋愛
        private static FortuneResult ComputeFortune(string name, string dateStr)
        {
            var rand = new Mulberry32(FortuneRandom.HashString($"mikuji|{dateStr}|{name ?? ""}"));

            int totalWeight = 0;
            foreach (var f in Fortunes) totalWeight += f.Weight;
            double r = rand.Next() * totalWeight;
            string fortune = Fortunes[Fortunes.Length - 1].Name;
            foreach (var f in Fortunes)
            {
                r -= f.Weight;
                if (r < 0) { fortune = f.Name; break; }
            }

            string Pick(string[] arr) => arr[(int)(rand.Next() * arr.Length)];
            var result = new FortuneResult
            {
                Date = dateStr,
                Name = name ?? "",
                Fortune = fortune,
                Item = Pick(LuckyItems)
            };
            var color = LuckyColors[(int)(rand.Next() * LuckyColors.Length)];
            result.ColorName = color.Name;
            result.ColorValue = ColorTranslator.FromHtml(color.Hex);
            result.Hitokoto = Pick(HitokotoList);
            result.Wish = Pick(MiniWish);
            result.Work = Pick(MiniWork);
            result.Love = Pick(MiniLove);
            return result;
        }

        // 🎲 おみくじを引いて結果を表示する
        private void Draw()
        {
            var result = ComputeFortune(nameBox.Text.Trim(), TodayString());
            RecordHistory(result);
            drawnNote.Visible = true;
            ShowResult(result);
            RenderHistory();
        }

        // 🍀 結果を画面に表示する
        private void ShowResult(FortuneResult result)
        {
            resultDate.Text = $"{result.Date} の運勢";
            fortuneLabel.Text = result.Fortune;
            resultFor.Text = result.Name.Length > 0 ? $"{result.Name} さんの運勢" : "";
            hitokotoLabel.Text = result.Hitokoto;
            itemValue.Text = result.Item;
            colorDot.BackColor = result.ColorValue;
            colorValue.Text = result.ColorName;
            miniWishText.Text = result.Wish;
            miniWorkText.Text = result.Work;
            miniLoveText.Text = result.Love;
            resultPanel.Visible = true;
        }

        // ==========================================
        // 💾 保存（Web版 localStorage 相当をローカルファイルで再現）
        // ==========================================

        // 📂 保存ファイルのパス（アプリ専用フォルダ内の mikuji-data.json）
        private static string DataPath =>
            Path.Combine(Application.LocalUserAppDataPath, "mikuji-data.json");

        // 📂 保存データを読み込む（壊れたデータは空として扱う）
        private void LoadData()
        {
            try
            {
                if (File.Exists(DataPath))
                {
                    var json = File.ReadAllText(DataPath);
                    _data = JsonSerializer.Deserialize<SaveData>(json) ?? new SaveData();
                }
            }
            catch { _data = new SaveData(); }
        }

        // 💾 保存データをファイルに書き出す（履歴は最新30件まで）
        private void SaveDataFile()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(DataPath)!);
                if (_data.History.Count > 30)
                    _data.History = _data.History.GetRange(0, 30);
                File.WriteAllText(DataPath, JsonSerializer.Serialize(_data));
            }
            catch { /* 保存できない環境では無視（Web版と同じ） */ }
        }

        // 🔥 訪問ストリークを更新して現在の連続日数を返す
        private int UpdateStreak()
        {
            var today = TodayString();
            if (_data.LastVisit == today)
            {
                return _data.Streak == 0 ? 1 : _data.Streak;
            }
            var yesterday = DateString(DateTime.Now.AddDays(-1));
            _data.Streak = _data.LastVisit == yesterday ? _data.Streak + 1 : 1;
            _data.LastVisit = today;
            SaveDataFile();
            return _data.Streak;
        }

        // 📝 今日の結果を履歴に記録する（同じ日付は二重に記録しない）
        private void RecordHistory(FortuneResult result)
        {
            if (!_data.History.Exists(h => h.Date == result.Date))
            {
                _data.History.Insert(0, new HistoryEntry
                {
                    Date = result.Date,
                    Fortune = result.Fortune,
                    Name = result.Name
                });
                SaveDataFile();
            }
        }

        // 📜 履歴一覧を画面に描く
        private void RenderHistory()
        {
            historyList.Items.Clear();
            foreach (var h in _data.History)
            {
                historyList.Items.Add($"{h.Date}　{h.Fortune}");
            }
            historyEmpty.Visible = _data.History.Count == 0;
            historyList.Visible = _data.History.Count > 0;
        }
    }
}

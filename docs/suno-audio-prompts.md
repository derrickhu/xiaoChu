# 灵宠消消塔 — Suno 音频生成提示词

> **游戏风格**：东方修仙 + 三消RPG + Roguelike通天塔
> **美术基调**：水墨国潮、灵兽仙境、五行元素（金木水火土）
> **音乐定位**：古风仙侠，兼具空灵禅意与热血战斗感
> **核心乐器**：古筝、琵琶、竹笛（箫）、二胡、编钟、大鼓（堂鼓/太鼓）

---

## 一、BGM 背景音乐

### 1. `bgm.mp3` — 主界面 / 探索 BGM

**Suno Prompt:**
```
Style of Music: Chinese xianxia ambient, lo-fi oriental chill
guzheng flowing arpeggios starting immediately from bar 1, no slow intro,
soft bamboo flute (xiao) melody weaving through,
light wind chimes and temple bells, distant erhu hum,
pentatonic scale in C, serene and mystical atmosphere,
cultivation meditation music, spirit realm peaceful garden,
tempo 92 BPM, seamless loop, no vocals, no buildup,
warm reverb like mountain valley echo,
feeling of immortal cultivator in tranquil spirit realm
```

**Tags:** `chinese xianxia`, `guzheng ambient`, `cultivation music`, `zen garden`, `lo-fi oriental`

**时长:** 90秒 | **循环:** 是 | **导出:** MP3 128kbps

---

### 2. `boss_bgm.mp3` — Boss战 BGM（生死对决，极度紧张）

> ⚠️ **核心要求**：从第一个毫秒就是**最大音量、最大强度**，绝对没有前奏、没有渐入、没有build-up！

**Suno Prompt:**
```
NO INTRO. START AT MAXIMUM VOLUME FROM BEAT 1.

Chinese dark battle music, 180 BPM, boss fight to the death.

INSTRUMENTS ATTACKING IMMEDIATELY:
- Taiko drums POUNDING at full force from second 0
- Erhu SCREAMING at highest pitch with distortion
- Pipa shredding violently non-stop
- Brass BLASTING aggressive stabs
- Strings at maximum tremolo intensity

SOUND CHARACTERISTICS:
- Harsh and aggressive, NO beauty NO sweetness
- Dissonant chords (tritones, minor 2nds) everywhere
- Relentless 16th note pulse creating panic
- Never slows down, never gets quiet
- Pure chaos and desperation
- Life-or-death feeling

MOOD: Demon lord boss, ancient evil awakening, player about to die any second.

NO VOCALS. SEAMLESS LOOP. NO QUIET MOMENTS. MAXIMUM INTENSITY ALWAYS.
```

**Tags:** `boss battle`, `180bpm`, `intense`, `aggressive`, `no intro`, `dark orchestral`, `desperate fight`

**时长:** 90秒 | **循环:** 是 | **导出:** MP3 128kbps

> **关键区分点**：
> - ❌ 绝对禁止：前奏、渐入、build-up、安静段落、舒缓旋律
> - ✅ 必须要有：瞬炸开场、持续高压、不协和音程、最快节奏

---

### 3. `stage_bgm.mp3`（新增）— 灵兽秘境关卡 BGM

**Suno Prompt:**
```
Style of Music: Chinese adventure RPG, upbeat xianxia dungeon
yangqin (hammered dulcimer) bouncy arpeggios leading the rhythm,
pipa plucking cheerful melody, dizi countermelody dancing above,
light percussion with woodblock and small drum keeping pace,
pentatonic major scale, adventurous and determined mood,
tempo 112 BPM, moderate energy like exploring a spirit beast cave,
occasional guzheng flourish on transitions,
feeling of young cultivator venturing into mystical realm,
no vocals, seamless loop
```

**Tags:** `chinese adventure`, `dungeon music`, `xianxia rpg`, `spirit realm`, `upbeat oriental`

**时长:** 75秒 | **循环:** 是

---

### 4. `victory_fanfare.mp3`（新增）— 通关胜利短乐

**Suno Prompt:**
```
Style of Music: Chinese triumphant fanfare, xianxia ascension jingle
suona horn announcing victory with bright ascending melody,
guzheng rapid ascending scale flourish,
bianzhong (ancient bells) chiming in celebration,
taiko drum final impact hit,
strings swell to glorious climax then gentle golden fadeout,
feeling of cultivator breaking through to next realm,
tempo 126 BPM, single play not loop,
bright major pentatonic, joyful and glorious, no vocals
```

**Tags:** `victory jingle`, `chinese celebration`, `ascension`, `breakthrough`

**时长:** 12~15秒 | **循环:** 否

---

## 二、SFX 战斗音效（打击爽感核心）

> **关键原则**：打击音效要有 **肉感和冲击力**，不能薄和虚。
> - **低频（100-250Hz）**：给力量感、拳头感
> - **中频（500-2kHz）**：给存在感、识别度
> - **高频（4-8kHz）**：给清脆反馈、打击感
> - **瞬态**：必须有清晰 sharp 的 attack，不能软绵绵

### 5. `attack.mp3` — 英雄普攻（打击爽感核心！）

> ⚠️ 这是玩家听到最多的音效，必须**极致爽快**！

**Suno Prompt:**
```
[Sound Effect]
immortal sword qi slash with devastating impact,

PHASE 1 (0.0-0.05s) - CUT:
- sharp metallic SWOOSH cutting through air at high velocity,
- bright high-frequency razor edge sound,

PHASE 2 (0.05-0.15s) - IMPACT:
- solid HEAVY impact with satisfying THUD,
- mid-bass punch at 150-250Hz for weight and power,
- jade crystal shattering undertone,
- like blade hitting demon armor with full force,

PHASE 3 (0.15-0.30s) - DECAY:
- quick ring decay with slight metallic resonance,
- no muddy tail, clean cutoff,

TOTAL 0.3 seconds,
must feel PUNCHY and POWERFUL,
player should feel satisfaction on every tap
```

**Tags:** `sword slash`, `impact hit`, `melee attack`, `satisfying`, `punchy`

---

### 6. `combo.mp3` — 连击基准音（最重要！被音阶复用）

**Suno Prompt:**
```
[Sound Effect]
pure crystalline jade bell strike, single clear note C5,
like hitting a spirit crystal singing bowl in mountain temple,
clean harmonic tone with gentle sustain and smooth decay,
NO noise NO distortion, harmonically pure sine-like tone,
suitable for pitch shifting 0.5x to 2.0x playback rate,
0.5 second duration, bright and musical,
pentatonic friendly base tone for combo system
```

> ⚠️ 这是整个连击音阶系统的基础音，必须音色干净、纯净、适合变速

---

### 7. `eliminate.mp3` — 珠子消除（消除爽感核心！）

> ⚠️ 三消游戏的灵魂音效，每次消除都要有**满足感**！

**Suno Prompt:**
```
[Sound Effect]
spirit bead match explosion with satisfying sparkle,

PHASE 1 (0.0-0.08s) - BURST:
- crystalline POP with quick upward pitch sweep,
- like three jade gems simultaneously detonating into light,

PHASE 2 (0.08-0.20s) - SPARKLE:
- high-frequency shimmer cascade,
- multiple tiny crystal fragments twinkling,
- airy magical particles dissipating,

PHASE 3 (0.20-0.35s) - FADE:
- gentle high-frequency fadeout,
- clean ending no mud,

TOTAL 0.35 seconds,
must feel REWARDING and SATISFYING,
instant dopamine hit on every match
```

**Tags:** `gem match`, `puzzle clear`, `sparkle pop`, `satisfying`, `magical`

---

### 8. `skill.mp3` — 技能释放（灵力爆发）

**Suno Prompt:**
```
[Sound Effect]
mystical qi energy burst from cultivator's palm,
low rumble gathering (0.15s) into focused RELEASE explosion,
bamboo flute undertone mixed with energy whoosh,
like spirit power channeling then unleashing,
0.5 second duration, powerful and magical,
reverb splash at the end
```

---

### 9. `pet_skill.mp3` — 灵宠技能（灵兽之力）

**Suno Prompt:**
```
[Sound Effect]
cute spirit beast magical ability activation,
playful ascending chime bells with soft mystical energy pop,
like baby dragon breathing first flame or water spirit splashing,
whimsical and spirited but still powerful,
0.4 second duration, bubbly mid-section with clean finish
```

---

### 10. `enemy_attack.mp3` — 敌人攻击（沉重威胁）

**Suno Prompt:**
```
[Sound Effect]
heavy dark demonic claw strike impact,
deep bass THUD with menacing distorted crunch,
like shadow beast slamming against spirit barrier,
darker EQ than hero attack, threatening and weighty,
brief low rumble tail, 0.35 second duration
```

---

### 11. `hero_hurt.mp3` — 英雄受伤（痛感反馈）

**Suno Prompt:**
```
[Sound Effect]
jade spirit shield cracking under impact,
sharp transient HIT followed by brief dissonant ring,
painful but not harsh, clear damage feedback signal,
like cultivator taking demon hit through weakened barrier,
0.3 second duration, alarming and urgent
```

---

### 12. `enemy_skill.mp3` — 敌人技能（妖气凝聚）

**Suno Prompt:**
```
[Sound Effect]
ominous dark qi energy gathering then releasing,
reverse cymbal swoosh building tension (0.3s),
then distorted magical burst explosion forward (0.3s),
sinister demon spell casting, eerie dark overtones,
0.6 second total, low-mid frequency dominant
```

---

### 13. `block.mp3` — 格挡（坚实防御）

**Suno Prompt:**
```
[Sound Effect]
solid jade shield deflection CLANG,
resonant metallic ring with stone solidity underneath,
like spirit barrier successfully blocking demon strike,
brief bright ring with satisfying defensive feedback,
0.25 second duration, clean and sturdy
```

---

### 14. `boss.mp3` — Boss出场（震撼登场）

**Suno Prompt:**
```
[Sound Effect]
dramatic earth-shaking boss demon appearance,
massive TAIKO drum impact with deep brass orchestral stinger,
sub bass drop reverberating like earthquake,
cymbal crash with long dramatic reverb tail,
intimidating presence announcement,
1.2 second duration, epic and terrifying,
stereo width maximized
```

---

### 15. `victory.mp3` — 击败敌人（爽快胜利）

**Suno Prompt:**
```
[Sound Effect]
quick triumphant ascending guzheng arpeggio,
fast pentatonic run up C-D-E-G-A-C' with bright energy,
final celebratory bell chime at peak,
satisfying enemy defeated feeling,
1.0 second duration, bright rewarding and clean
```

---

### 16. `gameover.mp3` — 游戏失败（修炼未竟）

**Suno Prompt:**
```
[Sound Effect]
somber descending erhu melody, three slow falling notes,
like cultivator's spirit energy fading away,
melancholic but dignified, not depressing,
long reverb fadeout into silence,
1.8 second duration, reflective and gentle
```

---

### 17. `levelup.mp3` — 升级/境界突破

**Suno Prompt:**
```
[Sound Effect]
bright ascending cultivation breakthrough fanfare,
three ascending bell chimes C-E-G building to radiant peak,
golden shimmer sparkle overlay throughout,
like cultivator ascending to next immortal realm,
achievement unlocked energy burst at climax,
0.8 second duration, exciting and rewarding
```

---

### 18. `reward.mp3` — 获得奖励（宝物发现）

**Suno Prompt:**
```
[Sound Effect]
magical treasure discovery chime,
like opening ancient cultivator's secret chest and finding glowing jade artifact,
soft sparkle intro then bright bell HIT then gentle shimmer tail,
warm inviting and delightful tone,
0.5 second duration
```

---

### 19. `rolling.mp3` — 棋子交换/拖拽

**Suno Prompt:**
```
[Sound Effect]
quick smooth jade bead sliding on wooden board,
like moving a Go stone or spirit pearl across carved surface,
subtle stone-on-wood texture click,
extremely short 0.15 second, clean transient,
no reverb tail, must feel responsive and tactile
```

---

### 20. `update3.mp3` — 三星图鉴解锁（稀有庆祝）

**Suno Prompt:**
```
[Sound Effect]
glorious three-star spirit beast awakening celebration,
star 1 chime at 0.0s, star 2 chime at 0.4s higher pitch,
star 3 chime at 0.8s highest pitch,
then golden burst fanfare at 1.2s with guzheng flourish and bells,
sparkle particles sound throughout like golden qi swirling,
2.0 second total duration, rare achievement feeling
```

---

## 三、UI / 交互音效（新增）

### 21. `click.mp3`（新增）— UI按钮点击

**Suno Prompt:**
```
[Sound Effect]
soft jade bead gentle tap on polished wood,
minimal and clean, like touching a spirit menu button,
0.08 second duration, comfortable for rapid repeated play,
soft attack no reverb, not fatiguing at all
```

---

### 22. `heal.mp3`（新增）— 回血

**Suno Prompt:**
```
[Sound Effect]
warm spring water restoration healing chime,
gentle ascending sparkle with green nature energy glow,
like spirit spring water mending cultivator's wounds,
soothing warm pad underneath with bright bell on top,
0.4 second duration, comforting and restorative
```

---

### 23. `shield.mp3`（新增）— 获得护盾

**Suno Prompt:**
```
[Sound Effect]
crystalline jade barrier activation hum,
brief energy whoosh forming protective spirit field,
sustained crystal resonance then quick fade,
like qi shield materializing around cultivator,
blue-white energy feeling,
0.35 second duration, protective and solid
```

---

## 四、Suno 使用指南

### 生成步骤

1. **BGM**：使用 Suno v4，选 **Instrumental** 模式，粘贴 prompt 到 Song Description
2. **SFX**：使用 Suno 的 **Sound Effects** 功能（或在 prompt 前加 `[Sound Effect]`）
3. 每个音效生成 2~4 个版本，挑效果最好的

### 后处理

| 步骤 | 工具 | 操作 |
|------|------|------|
| 裁剪 | Audacity | 裁到指定时长，去掉多余静音 |
| 淡出 | Audacity | BGM 结尾加 2s 淡出确保循环顺滑 |
| 响度 | Audacity | SFX 统一响度 -14 LUFS，BGM -20 LUFS |
| 导出 | Audacity | MP3 128kbps 单声道（SFX）/ 立体声（BGM） |

### 文件大小控制

| 类型 | 目标大小 | 说明 |
|------|---------|------|
| BGM | < 2MB | 90秒 128kbps 约 1.4MB |
| SFX 短音效 | < 15KB | 0.1~0.5秒 |
| SFX 中音效 | < 30KB | 0.5~1.5秒 |
| SFX 长音效 | < 80KB | 1.5~2.5秒（update3、boss） |

### `combo.mp3` 特别说明

这是整个游戏音效系统中**最重要**的一个文件：
- 被 `playbackRate` 从 0.5x 到 2.0x 变速，模拟 Do~Do' 八度音阶
- 连击 1~8 对应音阶递升，9+ 进入第二八度
- **必须是干净的纯音**，不能有杂音、噪音、混响尾巴
- 推荐生成后用 Audacity 手动清理，确保波形干净

### 文件替换

生成后直接同名替换：
- BGM → `audio_bgm/` 目录
- SFX → `audio/` 目录

新增的 `click.mp3`、`heal.mp3`、`shield.mp3` 放到 `audio/` 后，需要在 `js/runtime/music.js` 中注册对应的播放方法。

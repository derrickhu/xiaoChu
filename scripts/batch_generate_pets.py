#!/usr/bin/env python3
"""
Batch generate all 33 pets using 2x2 grid mode (normal + awakened in one image).
Each pet produces 1 grid image → split into 4 assets.
"""
import subprocess
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TMP_DIR = PROJECT_ROOT / "tmp"
PROMPT_DIR = TMP_DIR
GENERATE_SCRIPT = PROJECT_ROOT / ".cursor/skills/pet-art-generator/scripts/generate_pet.py"

GRID_PREFIX = """A single 1:1 square image divided into a 2×2 grid of 4 equal panels on one canvas, solid plain single-color background light gray #E0E0E0 across the entire image. All 4 panels depict the SAME creature species — normal form (top row) and awakened evolved form (bottom row).

TOP-LEFT PANEL — NORMAL FORM AVATAR: half-body bust portrait from head to mid-torso, adorable chibi creature, big head small body ratio 3:1, showing head, neck, chest, shoulders as one connected figure — not a floating head. Centered with clear margin from all edges especially the top. The face retains full animal anatomy: protruding animal snout/muzzle, small cute animal nose, animal mouth, animal proportions — NOT a flat human face. Large sparkling animal eyes with star-shaped highlights. EXPRESSION: warm, happy, cute, charming — a joyful or curious smile, NOT sad, NOT pouting. CRITICAL: The bottom of the character (chest/base, hem, or body edge) must extend FLUSH to the bottom edge of the panel — no floating, no circular cut, no empty gap below. This is the normal base form — young, cute, simple charming accessories.

TOP-RIGHT PANEL — NORMAL FORM FULL BODY: the exact same normal creature in full body view. FRONT-FACING toward the viewer, NOT sideways, NOT profile — body and face both face the camera. Eyes DIRECTLY looking at the viewer/screen. Creative battle-ready stance — pose can be dynamic and varied (leap, charge, defend, etc.), fills 70-80% of panel height. EXPRESSION: focused, alert, battle-ready — fitting combat scene.

BOTTOM-LEFT PANEL — AWAKENED FORM AVATAR: the SAME creature evolved. Same half-body bust framing. EXPRESSION: same cute charming expression — warm, happy, adorable. CRITICAL: The bottom of the character must extend FLUSH to the bottom edge of the panel — no floating, no circular cut, no empty gap below. Awakened upgrades: (1) refined body coloring — richer gradients; (2) body form evolution — e.g. more tails, evolved horns; (3) gold trim, jewel accents. Keep same cute chibi art style.

BOTTOM-RIGHT PANEL — AWAKENED FORM FULL BODY: the awakened creature in full body. FRONT-FACING toward the viewer, NOT sideways, NOT profile. Eyes DIRECTLY looking at the viewer/screen. A DIFFERENT action/pose from top-right — awakened must have a distinct battle stance or motion (e.g. if normal leaps forward, awakened could spin or strike differently). Creative and dynamic, fills 70-80% of panel height.

CRITICAL: Normal and awakened full-body poses (top-right vs bottom-right) must be DIFFERENT actions. Awakened can have body form changes (e.g. 1 tail → 4 tails) and refined body coloring as described. All full-body panels: face camera, eyes at viewer, no side view.

UNIFIED STYLE FOR ALL 4 PANELS: Chinese ink wash painting inspired with soft cel-shading for volume and depth, gentle highlights on rounded surfaces for 3D feel, calligraphy brush-style black ink outlines with varying thickness, rich vibrant colors mixing traditional Chinese pigments with pastel accent tones, fluffy soft texture rendering for fur and fabric, delicate detail work on accessories and patterns, warm inviting atmosphere, Chinese Xianxia mythology aesthetic with kawaii charm, NOT Western fantasy, NOT photorealistic, NOT 3D rendered, clean sharp ink-line edges for easy cutout.

ABSOLUTELY NO TEXT: Draw ZERO words, labels, captions, or panel titles. The image must contain ONLY illustrations — no letters anywhere.

ABSOLUTELY NO TEXT: The image must contain ZERO text — no labels, no captions, no panel titles, no words. Draw ONLY the illustrations.

STRICTLY FORBIDDEN: any text, letters, words, writing, watermark, symbols, seals, labels, captions, panel labels. STRICTLY FORBIDDEN: white outline outside black ink outlines, white border, white edge glow, white halo. Also forbidden: glow effects, blur, soft edges, lens flare. STRICTLY FORBIDDEN: humanoid form, human face, human body, flat human-like face on an animal. STRICTLY FORBIDDEN: any part of the character extending beyond or touching any panel boundary — every character must be fully contained within its panel.

"""

# 纯昆虫/无脸生物的专用前缀（不复用通用 GRID_PREFIX）
GRID_PREFIX_BUTTERFLY = """A single 1:1 square image divided into a 2×2 grid of 4 equal panels on one canvas, solid plain single-color background light gray #E0E0E0 across the entire image. All 4 panels depict the SAME creature — a PURE BUTTERFLY (纯蝴蝶). Normal form (top row) and awakened form (bottom row).

CRITICAL — PURE INSECT, NO ANTHROPOMORPHISM:
- Draw a REAL BUTTERFLY, NOT a cartoon character. NO human eyes, NO anime eyes, NO face, NO mouth, NO facial expression, NO cute chibi face.
- The butterfly has: (1) two pairs of large wings — WINGS are 90% of the visual; (2) a tiny head with thin antennae only — head is a small dark dot or minimal oval, NO visible eyes; (3) a small segmented thorax and abdomen; (4) six tiny legs.
- Beauty comes from the WINGS — their colors, patterns, and shape. The body/head are minimal and subordinate.

TOP-LEFT — NORMAL AVATAR: Butterfly viewed from above or 3/4 angle, wings spread. WINGS dominate — large, colorful (red, orange, gold, yellow, cyan, purple gradient 五彩), flame-like patterns. Tiny head with antennae, no face. Body small. Wings extend toward panel edges. Bottom of wings flush to panel bottom.

TOP-RIGHT — NORMAL FULL BODY: Same butterfly, full view. Wings fully spread like a flame flower. Body tiny between wings. Front-facing, wings symmetric. No eyes, no face. Dynamic: wings open as if mid-flight or display.

BOTTOM-LEFT — AWAKENED AVATAR: Evolved butterfly. Wings LARGER, more ornate — gold filigree patterns, richer multicolor gradient. Antennae tips: small flame or gem. Still PURE butterfly — no eyes, no face. Wings are the focus.

BOTTOM-RIGHT — AWAKENED FULL BODY: Awakened butterfly, different wing pose from top-right. Wings more elaborate, gold outlines, jewel-like patterns. Body unchanged — tiny. Pure insect form.

STYLE: Chinese ink wash inspired, soft cel-shading, elegant wing patterns like traditional painted butterfly specimens. Rich colors, clean ink outlines. Cute through beauty of wings only — NOT through face or eyes.

ABSOLUTELY NO: text, labels, words. FORBIDDEN: human eyes, anime eyes, cartoon face, mouth, nose, any facial features, anthropomorphic design. FORBIDDEN: white outline, glow, blur. Each butterfly must fit fully inside its panel.

"""

# 使用专用前缀的宠物（不复用通用 GRID_PREFIX）
GRID_PREFIX_OVERRIDES: dict = {}

# (normal_description, awakened_upgrades)
PETS = {
    "rock_badger": (
        "圆滚Q版岩獾宝宝，焦糖棕与奶白皮毛、带珊瑚粉腮红与薰衣草灰肚皮斑块。大大水晶蓝圆眼开心笑、NOT委屈。背有浅色石纹斑块，脖子珊瑚粉丝绸围巾配金扣，粉嫩内耳，蓬松短尾。配色丰富：焦糖棕、奶白、珊瑚粉、薰衣草灰、琥珀金。战斗姿态：前爪踏地、小嘴微张、尾巴翘起——呆萌小卫士。",
        "形态进化：石纹升级为琥珀水晶甲。增加：围巾升级绯红金绣小斗篷，金色护爪镶琥珀，面颊金丝花纹。保持开心可爱表情、丰富配色。",
    ),
    "flame_fox": (
        "蓬松可爱的小狐狸，奶白色身体配柔和蜜桃粉耳尖，大蓬松尾巴尾尖为日落橘色渐变，闪亮湖蓝绿大眼充满好奇活泼的神采，脖子系珊瑚粉丝带蝴蝶结，脸颊淡淡腮红，露出粉嫩小肉垫，胸前毛蓬松柔软。战斗姿态：俏皮扑击姿势前爪张开，小嘴微张露出奶牙，尾巴高翘——调皮小猎手。",
        "在普通形态基础上增加：耳朵挂金铃铛耳坠，丝带升级为朱红丝带系金丝坠子，尾巴增加华丽日落橘到樱花粉渐变金光，爪子增加金色护爪套。其余毛色、体型、眼睛、面部完全不变。",
    ),
    "blaze_lion": (
        "幼狮小崽（非狮王！），圆滚Q版：暖金奶油身体、蓬松柔软鬃毛呈珊瑚橘与蜜桃粉渐变（非深红火焰色）。耳内薰衣草粉、眼周薄荷绿淡影、肚皮奶白。大大琥珀金眼带星芒开心笑，仅迷你小金冠镶一颗红宝石，粉鼻头，无厚重项链无胸甲。战斗姿态：挺胸、一爪高举、小嘴张开发出可爱吼声——萌系幼狮，与焰天狮王截然不同。",
        "形态进化：鬃毛更蓬松柔和。增加：金冠镶多颗小红宝石，金色小胸饰，金色小爪套。保持幼狮萌态、柔和配色（珊瑚粉、薄荷绿、琥珀金），不要变成威严狮王。",
    ),
    "bubble_fish": (
        "圆滚滚的可爱河豚，柔和薰衣草蓝与奶白色身体点缀虹彩珍珠斑点，胖乎乎完美球形搭配小小半透明鳍，大大的水蓝色亮晶晶眼睛带着快乐笑容，小嘟嘟嘴旁浮着一个小气泡，两眼之间戴着精致水晶小冠，鳍边缘粉蓝渐变。战斗姿态：鼓成更大的防御球小刺微微竖起，脸颊更圆——坚定守护的小胖球。",
        "在普通形态基础上增加：水晶小冠升级为华丽金冠镶海蓝宝石与珍珠，鳍边缘增加金色蕾丝纹样，身周增加金色泡泡链饰品，鳞片泛虹彩光泽增强。其余身体颜色、体型、眼睛、面部完全不变。",
    ),
    "tide_whale": (
        "小鲸鱼精灵，光滑深藏蓝色身体和柔软白色肚腹，圆润温和的体态，大大的深色温柔眼睛带着平静祥和的表情、瞳中点缀金色碎芒，体侧有淡青蓝色水彩花纹，脖间缠绕小贝壳与珍珠花环项链，宽阔鳍有柔和青绿渐变边缘，喷水孔上方一小簇水雾。战斗姿态：向前冲涌穿过水漩涡，鳍大幅展开——温柔而强大的海洋守护者。",
        "在普通形态基础上增加：头顶增加华丽金色珊瑚冠，鳍边缘增加金色花纹与飘逸蓝丝带，珍珠项链升级为珍珠金链缀宝石蓝水滴坠，体侧花纹增加金色点缀。其余身体颜色、体型、眼睛、面部完全不变。",
    ),
    "iron_armadillo": (
        "可爱小犰狳，银蓝甲壳边缘玫瑰金、薰衣草紫肚皮、琥珀色水晶点缀。大大薰衣草灰圆眼带星芒、粉鼻、珊瑚粉腮红。耳戴紫水晶耳钉，分节尾末端金属球。配色：银蓝、玫瑰金、薰衣草紫、琥珀、珊瑚粉。战斗姿态（普通）：后腿蹬地、身体前倾、甲壳微竖——弹跳预备。战斗姿态（觉醒）：必须不同——如旋转翻滚冲击或四爪张开扑击。",
        "形态进化：脊背琥珀水晶列。增加：甲壳金丝镶花，爪尖金色，双耳紫水晶金耳环。觉醒全身动作必须与普通明显不同（如翻滚vs弹跳）。",
    ),
    "thunder_marten": (
        "灵巧可爱的小貂，深巧克力棕与奶油黄毛发，修长优雅的身体搭配大蓬松尾巴，明亮电黄色大圆眼带灵敏调皮的神情，小小带静电的胡须一脸淘气，尖耳内侧淡黄色，脖子薰衣草色编织项圈挂小金铃铛，尾尖有微小火花跳跃。战斗姿态：弓背炸毛因静电全身毛发直立，前爪张开呈玩闹攻击姿态——凶萌小闪电。",
        "在普通形态基础上增加：双耳挂金色闪电造型小耳坠，项圈升级为黑丝编绳挂黄水晶坠子，爪子增加金色爪鞘，毛尖金色静电闪烁增强。其余毛色、体型、眼睛、面部完全不变。",
    ),
    "blossom_bunny": (
        "毛茸茸的可爱兔子，雪白皮毛配柔软樱花粉内耳，圆滚滚身体搭配棉球尾巴，大大玫瑰粉眼睛闪烁星光，脖间自然缠绕樱花瓣如天然花环，头戴手编小雏菊花冠，脸颊粉红腮红，白色小肉垫，一只耳朵微微耷拉。战斗姿态：后腿站立前爪举起如拳击姿势，耳朵竖直警觉，鼓着腮帮子一脸坚定——虽小但超凶。",
        "在普通形态基础上增加：花冠升级为华丽金花冠饰满粉玉樱花与翠叶，双耳配金耳环垂挂樱花吊饰，增加华美粉金绣花披领，爪子增加金色爪镯带小翠玉铃。其余毛色、体型、眼睛、面部完全不变。",
    ),
    "jade_cat": (
        "优雅翠猫精灵，翠绿与暖奶油毛发、蝶翼耳毛翡翠金。配色丰富：翠绿、奶油、琥珀金眼影、珊瑚粉腮红、薰衣草紫耳内。翡翠大眼带星芒、粉鼻、编藤项圈翠叶玉坠。战斗姿态（普通）：低身跃起、双爪前伸、尾巴甩动——扑击瞬间。战斗姿态（觉醒）：必须不同——如旋转落地或弓背炸毛。动作生动有力。",
        "形态进化：花纹更精致。增加：金蝶翼耳饰镶翡翠，金藤蔓花冠，翠玉金丝披领，金爪戒翠滴坠。觉醒全身动作必须与普通明显不同。",
    ),
    "wood_qilin": (
        "麒麟幼崽——中国独角龙鹿混合神兽，翡翠绿与暖鹿黄色身体，鹿形身姿搭配小巧偶蹄，头顶单螺旋小角缠绕嫩绿藤蔓，大大金绿色灵目虽是幼崽面孔却透着古老智慧，脊背冒出小花苞，脖间缠绕野花编花环，蓬松下巴小胡须，羽状小尾叶形尖端。战斗姿态：后腿直立独角前指花朵沿身体绽放——可爱但威严的森林幼神。",
        "在普通形态基础上增加：螺旋角升级为宏伟金色角缠绕盛放金色樱花，角根处增加华丽金冠镶翡翠与和田玉，花环升级为翠玉金丝挂件缀翡翠坠，尾羽增加金色点缀。其余身体颜色、体型、眼睛、面部完全不变。",
    ),
    "dusk_bat": (
        "小巧可爱的蝙蝠，丝绒般深紫与梅色翼膜，圆滚滚小毛球身体搭配超大耳朵，大大发光紫罗兰色眼睛带着害羞好奇的神情，小尖牙可爱地从嘴边露出，柔和薰衣草灰腹毛，两耳间别着小月牙发卡，翼爪尖端涂成粉色，胸前蓬松小毛簇。战斗姿态：翼膜大幅展开做出戏剧性炫耀向前俯冲——拼命装吓人但太可爱了。",
        "形态进化：翼膜更宽大华丽、边缘有精致金色蕾丝纹。增加：月牙发卡升级为华丽金色月牙冠镶紫水晶，翼关节金爪帽镶紫水晶，背部迷你紫丝绒金星绣斗篷，耳朵金链耳环缀星形吊饰。身体配色更精致、紫水晶色与金紫渐变更饱满。",
    ),
    "moon_jellyfish": (
        "纯水母形态，无动物头、无拟人面部、无眼睛无嘴巴。真实水母：透明伞盖呈薰衣草紫与珍珠白，边缘虹彩流光，丝缎般触须带淡蓝渐变，体内粉蓝光芯如月光。伞顶小珍珠花饰，触须尖端发光珠串。Q版圆润比例，通过色彩与伞盖弧度表现灵动可爱。战斗姿态：伞盖张开触须伸展——水中梦幻灯笼。",
        "形态进化：触须增多如金银丝缎，伞盖更大极光色边缘。增加：金珍珠冠饰、触须末端金色星形吊坠、伞盖金色蕾丝纹。配色更饱满。保持纯水母形态，无动物头。",
    ),
    "fire_wisp": (
        "小巧可爱的火元素精灵，温暖橘色与柔珊瑚色圆圆小身体，花瓣状火焰触手作为四肢，大大明亮金黄眼睛带着调皮捣蛋的笑容，红扑扑脸颊，周围漂浮微小火星如萤火虫，体内可见温暖桃色光芯如灯笼，头顶系一个小红丝带蝴蝶结。战斗姿态：身体火焰扩大花瓣火焰延伸触手向前玩闹般攻击——越努力越可爱。",
        "形态进化：火焰触手更多、呈几何火纹排列更华丽，核心更明亮炽热。增加：华丽金火焰冠镶红宝石，金色集中光芯，火焰尖端金色火星丝带，金链托红宝石坠。身体配色更精致、白热金红渐变更饱满。",
    ),
    "inferno_dragon": (
        "远古巨龙，深绯红与熔金色身体有龟裂火山鳞纹透出内在暖光，Q版比例但依然气势磅礴的龙形，炽烈琥珀橘大眼配竖瞳显示无穷力量，宏大弯曲角有金色尖端，宽阔翅膀绯红翼膜带战斗伤痕，粗壮尾巴末端熔岩锤头，颈挂厚重金链搭配大红宝石勋章，身上古老战疤增添阅历。战斗姿态：巨口大张露出内在火热翅膀撑开戏剧性剪影——远古至尊之力。",
        "形态进化：双角更宏大、翅膀更壮观翼膜边缘金熔岩脉纹，尾巴熔岩锤更炽烈。增加：华丽金岩浆冠镶火欧泊，翅膀红宝石点缀，华美金胸甲中央太阳红宝石，鳞纹裂缝金色光泽。身体配色更精致、黑曜石与炽金岩浆纹更饱满。",
    ),
    "stone_turtle": (
        "圆滚滚可爱的乌龟，橄榄绿与暖棕色龟壳上长着小水晶如微型花园，胖乎乎身体粗壮短腿，大大深琥珀色智慧老眼带着耐心瞌睡的表情，皱纹像老神仙般的面庞挂着温和微笑，脖子围小苔绿色针织围巾，壳上小水晶花如天然装饰，粉色颊斑。战斗姿态：半缩壳内龟壳斜向前方当盾牌一只眼睛从壳中窥出——坚定不移的小堡垒。",
        "形态进化：龟壳更大、水晶簇更茂盛如金色花园，壳板纹路更清晰。增加：精致金翠颈饰，金琥珀水晶与盛开金色花朵，壳边缘金色镶花纹饰，每片壳板金色大地符文。身体配色更精致、深花岗岩与金琥珀渐变更饱满。",
    ),
    "rock_pixiu": (
        "圆滚Q版小貔貅——中国招财瑞兽，暖赭石与奶金双色皮毛，肉嘟嘟身体粗短腿。一根可爱弯曲独角，大大琥珀圆眼呆萌笑，小嘴微张露小牙，迷你短翅贴背不夸张（仅一对小翅），脖子铜钱串，蓬松尾巴，粉嫩内耳。配色：暖赭、奶金、琥珀、珊瑚粉。战斗姿态：前爪踏地、小嘴张开——萌系招财宝宝。",
        "形态进化：独角升级金角镶琥珀，增加小巧金甲胸口聚宝盆纹，短翅边缘祥云金纹，铜钱链缀宝石。保持圆滚可爱、一对小翅。",
    ),
    "bolt_eagle": (
        "可爱小雷鹰，暖金色与奶棕色羽毛，翼缘电蓝色条纹，紧凑圆润Q版鹰体。只有一对翅膀（标准鸟翼，禁止额外翅膀）。锐利但萌的电黄大眼，粉嫩钩喙，扇形大尾金色横纹，腿编天蓝金友谊手链。配色丰富：暖金、奶棕、电蓝、樱花粉腮红。战斗姿态：单翅展开、爪带小火花——萌系天空战士。",
        "在普通形态基础上增加：头顶小巧金冠镶黄水晶，爪子金色爪套。翅膀保持一对，羽尖金色点缀。其余羽色、体型、眼睛、面部完全不变。",
    ),
    "storm_tiger": (
        "萌系雷虎幼崽，暖白与琥珀金条纹毛发、边缘电蓝光晕，圆润Q版身体。大大电黄圆眼带星芒、活泼可爱非凶戾，粉鼻头、内耳淡蓝，厚实小爪带电火花，粗尾末端闪电形。暖色项圈镶黄水晶。配色：暖白、琥珀金、电蓝、樱花粉。战斗姿态：俏皮扑击、尾巴甩出小电弧——可爱小雷兽。",
        "形态进化：条纹升级为金闪纹理。增加：小巧金雷冠镶黄水晶，项圈升级金色缀雷电吊饰。保持可爱萌态、丰富配色。",
    ),
    "leaf_deer": (
        "优雅小鹿，柔和翡翠绿与暖鹿棕色身体，纤细修长的腿配小巧偶蹄，头顶嫩芽小角长着新绿嫩叶，大大深绿温柔眼睛带宁静表情和金色高光，背上白色斑点如阳光透过树冠洒在林地，一条前腿编着花藤脚链，柔软白色短尾，粉鼻头。战斗姿态：优雅跃起前腿收起嫩角前指——自然的优雅与勇气。",
        "在普通形态基础上增加：小角升级为宏大金色分枝鹿角盛开樱花与翡翠叶，头戴金藤冠缀翠玉滴坠，四腿增加华丽金翠脚链，增加金色蹄帽。其余毛色、体型、眼睛、面部完全不变。",
    ),
    "thorn_hedgehog": (
        "圆滚滚的胖刺猬，深绿与暖棕色身体，背上的刺是活的荆棘藤蔓其间绽放粉白小花，完美球形身体，大大深绿眼睛带害羞胆怯的表情，小粉鼻头，蜷曲小爪带粉色肉垫，柔软奶油色肚皮毛，一只爪子上戴小手编花手链，粉色脸颊腮红。战斗姿态：蜷缩成防御球花藤刺全部竖起一只眼睛从缝隙窥出——可爱又炸毛。",
        "在普通形态基础上增加：增加金色荆冠镶翠玉与玫瑰石英小宝石，双前爪增加金花藤手链，脸颊增加金丝藤蔓花纹，刺尖升级为金色，花朵增加金色和薰衣草色品种。其余毛色、体型、眼睛、面部完全不变。",
    ),
    "flora_serpent": (
        "华丽的大蛇精灵，深翡翠色身体全身盛放各色花朵——粉、薰衣草、金、白——犹如一座活的移动花园，大大翡翠色眼睛带高贵花王神情，头顶花冠角开着最大最美的花朵，鳞间藤蔓纹理和小叶片，颈部缠绕最美天然花环，身体延伸飘逸藤蔓丝带。战斗姿态：身体S形扭动花瓣纷飞四散——百花怒放中震撼的美与威严。",
        "在普通形态基础上增加：花朵升级为金色或珠宝色花朵，花冠升级为华丽金花冠盛开金翠花朵，鳞纹增加金藤精雕细琢，颈饰增加华美金翠飘逸金丝带缀翡翠坠。其余身体颜色、体型、眼睛、面部完全不变。",
    ),
    "vermilion_chick": (
        "圆滚滚的朱雀小雏鸟，鲜艳朱红与暖金色绒毛，完美圆胖雏鸟身体搭配小短翅膀，大大明亮橘金色眼睛跃跃欲试的兴奋表情，小黄喙，头顶小朱红冠羽如迷你莫西干，粉色小脚，一条脚踝挂金链坠心形红宝石，腹部羽毛暖金橘色渐变。战斗姿态：翅膀用力展开试图起飞蹦跳前冲小喙大张发出小小凶叫——最大努力的小凤凰。",
        "在普通形态基础上增加：冠羽升级为精致金色头冠镶红宝石与黄水晶，翅缘增加橘粉金火焰渐变纹，增加优雅修长尾翼火焰尖端金羽点缀，脚踝增加朱红丝绳挂红宝石金坠。其余羽色、体型、眼睛、面部完全不变。",
    ),
    "inferno_lion_king": (
        "至尊狮王（非幼狮！），Q版但威严：深绯红与熔金鬃毛向上炸开如真火尖刺、墨金黑边缘，身体绯红与金棕。炽白金大眼竖瞳、王者气度。颈挂厚重华美金项链中央太阳红宝石，金色火焰爪，尾端火焰毛簇。鬃毛尖刺状而非蓬松，与焰狮的柔和幼狮截然不同。战斗姿态：鬃毛火爆炸开的壮观咆哮——绝对火王。",
        "形态进化：帝冠镶火欧泊与红宝石，金色胸甲中央炽日圆盘，鬃毛中金饰穿插。保持威严狮王、深绯熔金配色，绝不变成萌系幼狮。",
    ),
    "frost_otter": (
        "圆滚滚的小水獭，银白色与柔和天蓝色的柔软皮毛，胖嘟嘟身体和短短小手，大大冰蓝色明亮眼睛带天真快乐的笑容，圆圆小耳内侧粉色，粉嫩小鼻头，小手抱着一颗透亮冰蓝色圆珠子——它的宝贝，头上戴贝壳和小冰花编成的精致发箍，蓬松小尾巴微卷。战斗姿态：双手举起冰珠准备投掷身体后倾蓄力表情超级认真——拼尽全力。",
        "在普通形态基础上增加：发箍升级为华丽银金冰晶冠镶蓝宝石与月光石，项链增加精致珍珠与冰晶编织，冰珠升级为璀璨蓝宝石球，耳朵增加精致银色雪花耳坠。其余毛色、体型、眼睛、面部完全不变。",
    ),
    "ocean_xuanwu": (
        "可爱Q版玄武幼体——龟蛇合体，暖青蓝龟壳带水波纹，奶白肚皮，壳上缠绕小巧可爱的深蓝银色小蛇伙伴。圆润厚实龟身，大大温柔碧蓝圆眼呆萌，粉鼻头，龟壳边缘珍珠如星辰，蛇戴银色小铃铛。配色温暖：青蓝、奶白、银蓝、珊瑚粉腮红。战斗姿态：龟壳当盾、蛇从壳后探出——萌系双重守护。",
        "形态进化：龟壳边缘镶金色宝石星辰环，蛇伙伴金色鳞片、蓝宝石眼，壳顶金色北斗七星纹。保持可爱圆润、温暖配色。",
    ),
    "golden_pangolin": (
        "萌系小金穿山甲，鳞片金棕与米黄、边缘玫瑰金光泽、肚皮翡翠绿斑点。大大琥珀圆眼好奇、粉鼻、珊瑚粉腮红。一只耳紫水晶耳钉，前爪编织手环。配色：金棕、米黄、玫瑰金、翡翠绿、紫水晶、珊瑚粉。战斗姿态：半蜷蓄力、前爪伸出、鳞片闪金属光——准备弹射的萌球。",
        "形态进化：鳞片镀金刻纹，脊背镶琥珀宝石。增加：金王冠造型鳞片，爪尖金色，尾端金铃铛。保持翡翠绿肚皮、紫水晶、丰富配色。",
    ),
    "boulder_ox": (
        "Q版小岩牛——换为更萌体型，暖巧克力棕与奶灰皮毛、青金石蓝大眼带星芒、暖金鼻环。角有琥珀金纹，蹄子岩石质感。胸前编绳挂琥珀穗子。配色：巧克力棕、奶灰、青金石蓝、琥珀金、珊瑚粉腮红。表情温和可爱。战斗姿态：前蹄扬起、低头蓄力冲撞、地面裂纹——萌系小山灵。",
        "形态进化：角升级金丝雕花镶琥珀，鼻环华丽金缀琥珀坠。增加：金色石甲胸饰山峰浮雕，挂具镶黄玉。保持萌态、青金石蓝眼、丰富配色。",
    ),
    "wind_falcon": (
        "流线型小隼鸟，苍白灰白与银色羽毛带珍珠光泽，为速度而生的精炼体型，锐利淡青色大眼专注凝视，深色弯钩喙，尖锐翼尖有冰蓝渐变，银白横纹扇尾，小利爪，一条腿系银色风铃吊坠配天蓝丝带，冷色优雅羽毛。战斗姿态：翅膀收拢成俯冲姿态身体完美流线双眼锁定——极致速度的专注猎手。",
        "在普通形态基础上增加：增加华丽银金头冠镶月光石与海蓝宝石，增加壮美后掠冠羽如皇家头盔造型，银坠升级为精美月光石银坠配铂金丝绳，爪子增加金色爪套。其余羽色、体型、眼睛、面部完全不变。",
    ),
    "cloud_leopard": (
        "优雅雪豹，纯白与淡银色皮毛有柔和云朵形旋涡斑纹，修长优美身体，大大明亮浅青色眼睛冷酷优雅的表情，长弯曲尾巴末端缥缈云纹，小圆耳内侧银粉色，优雅长须，脖子淡薰衣草丝带系银星坠，蓬松胸毛如云朵。战斗姿态：优雅低伏潜行尾巴如画般摆动双眼锁定——高雅而致命。",
        "在普通形态基础上增加：增加小铂金月牙耳环，银星坠升级为精美月光石银丝镶坠，爪子增加银爪套镶月光石，尾尖增加银云吊饰带小铃铛。其余毛色、体型、眼睛、面部完全不变。",
    ),
    "celestial_white_tiger": (
        "萌系白虎幼崽——中国西方守护神兽，纯白与暖银灰条纹、带淡金与樱花粉腮红点缀。圆润Q版身体，大大淡金圆眼带星芒活泼可爱，白耳内侧银粉，额头『王』字花纹，厚实小爪银色爪尖，粗尾末端银色。脖子银链配月光石。配色丰富：纯白、暖银灰、淡金、樱花粉、月光石蓝。战斗姿态：俏皮蓄力、皮毛微竖——可爱小虎神。",
        "形态进化：条纹升级铂金神纹。增加：小巧铂金虎冠镶月光石，胸口月光石太极徽记，爪尖银金爪鞘。保持可爱萌态、丰富暖色点缀。",
    ),
    "bamboo_panda": (
        "毛茸茸的小熊猫（红色的小浣熊般外貌的小熊猫，不是黑白大熊猫），蓬松赤褐色与暖橘色皮毛，圆圆的脸上有白色面罩花纹超级可爱，大大巧克力棕色圆眼带慵懒又好奇的表情，尖尖小耳内侧白色绒毛，蓬松巨大条纹环纹尾巴几乎比身体还大，小手抱着一节嫩竹子在啃，头上别着翠绿竹叶发卡，毛球般身体。战斗姿态：把竹子当小棍棒挥舞站直身体蓬松大尾巴炸开——拼命装凶但可爱到犯规。",
        "在普通形态基础上增加：竹叶发卡升级为华丽金竹叶花冠编织翡翠叶与小金铃，尾巴环纹增加金色升级蓬松翻倍，增加金色小耳坠缀翡翠竹叶吊饰，竹子升级为翡翠金节仙竹杖，增加金绿编织围巾。其余毛色、体型、眼睛、面部完全不变。",
    ),
    "flame_butterfly": (
        "可爱Q版蝴蝶精灵——昆虫身体NOT动物身体。小圆头大大琥珀金眼睛带星芒、粉嫩腮红、两根卷曲触角末端火苗，光滑暖橘色昆虫身体（胸腹分段、无毛、非哺乳动物），六只纤细小脚。背后超大华丽蝴蝶翅膀——翅膀面积远大于身体，配色鲜艳多彩：樱花粉、珊瑚红、暖金、日落橘、薰衣草紫、天青蓝多色渐变交融如彩虹火焰，翅面精致花纹脉络如彩色玻璃窗。身体周围飘浮微小彩色火星。战斗姿态：巨翅完全张开、身体前倾触角朝前——炽烈蝶舞。",
        "在普通形态基础上增加：翅膀色彩更饱满华丽（粉红、金、紫、蓝层叠渐变），翅面花纹升级为金丝镂空火焰蕾丝。琥珀金大眼带红宝石星芒瞳，触角升级为金卷须顶端红宝石火珠，身体增加金色小胸饰镶红宝石，金色小脚环。其余颜色、眼睛完全不变。",
    ),
    "cosmos_dragon": (
        "壮丽的五色中华龙，苍白金与奶白色身体上鳞片闪烁五行元素色——红蓝绿金棕——和谐交融如彩虹龙，至尊中华长龙蛇形流线体态，大大棱镜色彩目光有虹彩深邃，壮美多彩飘逸鬃毛和长须，每片鳞片都是不同宝石色形成虹龙效果，下颌含着巨大多彩珠，金色爪和华美螺旋角，厚重金项圈镶五枚不同元素宝石。战斗姿态：身体螺旋盘绕展示至尊力量五色同时和谐炽放——绝对至尊龙神。",
        "在普通形态基础上增加：增加华丽金色神冠镶五枚元素宝石呈星阵排列，金须金鬃增加彩虹丝线穿插，增加华美金神颈饰缀五大元素巨宝石拖金链，角尖增加金色装饰，爪增加金色爪鞘。其余鳞片颜色、体型、眼睛、面部完全不变。",
    ),
}


CREATURE_FORM_OVERRIDES = {
    "flame_butterfly": "\n\nCRITICAL OVERRIDE FOR BUTTERFLY: IGNORE all animal/mammal face and body instructions above. This creature is an INSECT (昆虫), NOT a mammal. Body must be: smooth segmented insect body (thorax + abdomen), NO fur, NO animal snout/muzzle, NO paws. Head: small round insect head with big cute eyes and two antennae. Limbs: six thin insect legs, NOT animal legs. Wings: two pairs of large gorgeous butterfly wings dominate the image. Keep same Q版 chibi cute art style, ink wash outlines, warm colors — just insect anatomy instead of animal anatomy. NO text.\n",
    "moon_jellyfish": "\n\nCRITICAL OVERRIDE FOR JELLYFISH: IGNORE animal face instructions. Draw PURE jellyfish — bell/umbrella, tentacles. NO face, NO eyes, NO mouth, NO human/animal head. Cute Q版 through colors and bell shape only.\n",
    "blaze_lion": "\n\nCRITICAL — blaze_lion is a CUB (幼狮), NOT a king. Must look VERY different from inferno_lion_king: soft rounded mane (coral/orange/peach gradient), NO heavy necklace, NO chest armor, tiny crown only. Cute baby lion, warm pastel colors. NO text.\n",
    "inferno_lion_king": "\n\nCRITICAL — inferno_lion_king is the LION KING (狮王), NOT a cub. Must look VERY different from blaze_lion: spiky flame mane (deep crimson/gold), heavy gold necklace with sun gem, ornate crown, gold chest armor. Majestic and威严. Deep intense colors. NO text.\n",
}


def write_prompt(pet_id: str, normal_desc: str, awakened_desc: str) -> Path:
    PROMPT_DIR.mkdir(parents=True, exist_ok=True)
    prefix = GRID_PREFIX_OVERRIDES.get(pet_id, GRID_PREFIX)
    # 使用专用前缀时不叠加 CREATURE_FORM_OVERRIDES（已内置）
    extra = "" if pet_id in GRID_PREFIX_OVERRIDES else CREATURE_FORM_OVERRIDES.get(pet_id, "")
    prompt = (
        prefix
        + f"NORMAL FORM: {normal_desc}\n"
        + f"AWAKENED FORM: {awakened_desc}\n"
        + extra
    )
    path = PROMPT_DIR / f"{pet_id}_grid_prompt.txt"
    path.write_text(prompt, encoding="utf-8")
    return path


def run_one(pet_id: str) -> bool:
    prompt_file = PROMPT_DIR / f"{pet_id}_grid_prompt.txt"
    if not prompt_file.exists():
        print(f"  ERROR: prompt file not found: {prompt_file}")
        return False
    cmd = [
        "python3",
        str(GENERATE_SCRIPT),
        "--grid",
        str(prompt_file),
        str(PROJECT_ROOT),
        pet_id,
    ]
    result = subprocess.run(cmd, cwd=PROJECT_ROOT)
    return result.returncode == 0


def main():
    pet_ids = list(PETS.keys())
    total_all = len(pet_ids)

    # python batch_generate_pets.py [start] [end]  — 1-based range
    # python batch_generate_pets.py pet_id1 pet_id2 ...  — specific pets
    if len(sys.argv) > 1 and sys.argv[1] in PETS:
        selected = [pid for pid in sys.argv[1:] if pid in PETS]
    else:
        start = int(sys.argv[1]) if len(sys.argv) > 1 else 1
        end = int(sys.argv[2]) if len(sys.argv) > 2 else total_all
        start = max(1, min(start, total_all))
        end = max(start, min(end, total_all))
        selected = [pet_ids[i - 1] for i in range(start, end + 1)]

    total = len(selected)
    if not selected:
        print("No valid pets selected.", file=sys.stderr)
        sys.exit(1)

    print(f"Writing {total} grid prompt files...")
    for pet_id in selected:
        normal_desc, awakened_desc = PETS[pet_id]
        write_prompt(pet_id, normal_desc, awakened_desc)
    print(f"Done. Starting sequential generation of {total} pets (1 grid image each)...\n")

    ok, fail = 0, 0
    failed_list = []
    for idx, pet_id in enumerate(selected, start=1):
        print(f"\n{'='*60}")
        print(f"[{idx}/{total}] {pet_id}")
        print(f"{'='*60}")
        if run_one(pet_id):
            ok += 1
            print(f"  OK: {pet_id}")
        else:
            fail += 1
            failed_list.append(pet_id)
            print(f"  FAILED: {pet_id}")
        if idx < total:
            print("  Waiting 15s...")
            time.sleep(15)

    print(f"\n{'='*60}")
    print(f"DONE: {ok} ok, {fail} failed out of {total}")
    if failed_list:
        print(f"Failed: {', '.join(failed_list)}")
    print(f"{'='*60}")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()

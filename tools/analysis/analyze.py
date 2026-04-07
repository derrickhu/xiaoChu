"""
灵宠消消塔 — 玩家数据分析脚本
读取从微信云数据库导出的 JSON，生成各维度分析图表和统计摘要。

用法:
  1. 先用 export.sh 或云控制台导出数据到 data/ 目录
  2. pip install -r requirements.txt
  3. python analyze.py
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from collections import Counter, defaultdict

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib

# 中文字体支持
matplotlib.rcParams['font.sans-serif'] = ['PingFang SC', 'Heiti TC', 'SimHei', 'Arial Unicode MS']
matplotlib.rcParams['axes.unicode_minus'] = False

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / 'data'
OUTPUT_DIR = SCRIPT_DIR / 'output'
# analyze.py 在 tools/analysis/ 下，仓库根为再上两级
REPO_ROOT = SCRIPT_DIR.parent.parent

# 秘境评级→星数（与 js/data/storage.js 一致）
_STAGE_RATING_TO_STARS = {'S': 3, 'A': 2, 'B': 1}
_RE_STAGE_NORMAL = re.compile(r'^stage_(\d+)_(\d+)$')
_RE_STAGE_ELITE = re.compile(r'^stage_(\d+)_(\d+)_elite$')

# 从仓库 weapons.js / pets.js 解析静态表（供单玩家透视）
_WEAPON_LINE_RE = re.compile(
    r"\{ id:'(w\d+)',\s+name:'([^']*)',\s+desc:'([^']*)',\s+type:'([\w]+)'"
)
_PET_HEAD_RE = re.compile(r"\{ id:'(\w+)',\s+name:'([^']*)'")
_PET_ID_ATTR_HINT = {'m': 'metal', 'w': 'wood', 's': 'water', 'f': 'fire', 'e': 'earth'}


def infer_pet_attr_from_id(pet_id):
    if not pet_id or not isinstance(pet_id, str):
        return ''
    c = pet_id[0].lower()
    return _PET_ID_ATTR_HINT.get(c, '')


def load_weapon_details():
    """id → {name, desc, type}"""
    path = REPO_ROOT / 'js' / 'data' / 'weapons.js'
    if not path.exists():
        return {}
    text = path.read_text(encoding='utf-8')
    return {
        m.group(1): {'name': m.group(2), 'desc': m.group(3), 'type': m.group(4)}
        for m in _WEAPON_LINE_RE.finditer(text)
    }


def load_pet_names():
    """宠物 id → 名称"""
    path = REPO_ROOT / 'js' / 'data' / 'pets.js'
    if not path.exists():
        return {}
    text = path.read_text(encoding='utf-8')
    return dict(_PET_HEAD_RE.findall(text))


def pet_pool_dataframe(rec, pet_names=None):
    pet_names = pet_names or {}
    rows = []
    pool = rec.get('petPool') if isinstance(rec.get('petPool'), list) else []
    for item in pool:
        if not isinstance(item, dict):
            continue
        pid = item.get('id') or ''
        attr = item.get('attr') or infer_pet_attr_from_id(pid)
        rows.append({
            '宠物ID': pid,
            '名称': pet_names.get(pid, ''),
            '属性': attr,
            '星级': item.get('star', 1),
            '等级': item.get('level', 1),
            '碎片': item.get('fragments', 0),
            '来源': item.get('source', ''),
        })
    df = pd.DataFrame(rows)
    if not df.empty and '星级' in df.columns:
        df = df.sort_values(['星级', '等级', '宠物ID'], ascending=[False, False, True])
    return df


def weapon_collection_dataframe(rec, weapon_details=None):
    weapon_details = weapon_details or {}
    eq = rec.get('equippedWeaponId')
    col = rec.get('weaponCollection') if isinstance(rec.get('weaponCollection'), list) else []
    rows = []
    for wid in col:
        if not wid:
            continue
        info = weapon_details.get(wid, {})
        rows.append({
            '法宝ID': wid,
            '名称': info.get('name', ''),
            '效果类型': info.get('type', ''),
            '简述': (info.get('desc') or '')[:120],
            '当前装备': '✓' if wid == eq else '',
        })
    return pd.DataFrame(rows)


def stage_clear_dataframe(rec):
    scr = rec.get('stageClearRecord') if isinstance(rec.get('stageClearRecord'), dict) else {}
    rows = []
    for sid, r in scr.items():
        if not isinstance(r, dict) or not r.get('cleared'):
            continue
        br = r.get('bestRating')
        stars = _STAGE_RATING_TO_STARS.get(br, 0)
        rows.append({
            '关卡': sid,
            '最高评级': br,
            '折算星': stars,
            '通关次数': r.get('clearCount', 0),
        })
    if not rows:
        return pd.DataFrame(columns=['关卡', '最高评级', '折算星', '通关次数'])
    sdf = pd.DataFrame(rows)

    def sk(row_id):
        raw = str(row_id).replace('stage_', '').replace('_elite', '')
        parts = [p for p in raw.split('_') if p.isdigit()]
        try:
            tup = tuple(int(p) for p in parts)
            return tup + (1,) if str(row_id).endswith('_elite') else tup + (0,)
        except ValueError:
            return (999, 999, 0)

    sdf['_k'] = sdf['关卡'].map(sk)
    sdf = sdf.sort_values('_k').drop(columns=['_k'])
    return sdf


def pet_dex_dataframe(rec, pet_names=None):
    pet_names = pet_names or {}
    dex = rec.get('petDex') if isinstance(rec.get('petDex'), list) else []
    rows = [{'宠物ID': pid, '名称': pet_names.get(str(pid), ''), '属性': infer_pet_attr_from_id(str(pid))}
            for pid in dex]
    return pd.DataFrame(rows)


def fragment_bank_dataframe(rec):
    fb = rec.get('fragmentBank') if isinstance(rec.get('fragmentBank'), dict) else {}
    rows = []
    for k, v in fb.items():
        try:
            n = int(v)
        except (TypeError, ValueError):
            n = 0
        rows.append({'宠物ID': k, '碎片': n})
    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.sort_values('碎片', ascending=False)
    return df


def idle_dispatch_dataframe(rec, pet_names=None):
    pet_names = pet_names or {}
    idle = rec.get('idleDispatch') if isinstance(rec.get('idleDispatch'), dict) else {}
    slots = idle.get('slots') if isinstance(idle.get('slots'), list) else []
    rows = []
    for i, s in enumerate(slots):
        if not isinstance(s, dict):
            continue
        pid = s.get('petId', '')
        rows.append({
            '槽位': i + 1,
            '宠物ID': pid,
            '名称': pet_names.get(str(pid), ''),
            '开始时间': _fmt_ts_ms(s.get('startTime')),
        })
    return pd.DataFrame(rows)


def build_player_select_labels(players):
    """下拉用 (展示文案, players 下标)"""
    opts = []
    for i, p in enumerate(players):
        if not isinstance(p, dict):
            continue
        oid = str(p.get('_openid') or p.get('openid') or '')
        tail = oid[-10:] if len(oid) >= 10 else (oid or f'#{i}')
        sp = compute_stage_progress(p)
        bf = int(p.get('bestFloor') or 0)
        pet_n = len(p.get('petPool')) if isinstance(p.get('petPool'), list) else 0
        w_n = len(p.get('weaponCollection')) if isinstance(p.get('weaponCollection'), list) else 0
        label = f'{tail} | 秘境★{sp["stage_total_stars"]} | 塔{bf}层 | 宠{pet_n} | 法宝{w_n}'
        opts.append((label, i))
    return opts


# ========== 数据加载 ==========

def load_collection(name):
    """加载云数据库导出的 JSON 文件（支持整体数组或按行 JSON）"""
    filepath = DATA_DIR / f'{name}.json'
    if not filepath.exists():
        print(f'  [跳过] {filepath} 不存在')
        return []

    text = filepath.read_text(encoding='utf-8').strip()
    if not text:
        return []

    # 尝试整体 JSON 数组
    if text.startswith('['):
        return json.loads(text)

    # 按行 JSON（tcb 导出格式：每行一个 JSON 对象）
    records = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


# ========== 分析模块 ==========

def analyze_stage_main(players):
    """秘境（主玩法）进度分布"""
    mlist = [compute_stage_progress(p) for p in players if isinstance(p, dict)]
    if not mlist:
        return
    mdf = pd.DataFrame(mlist)
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    stars = mdf['stage_total_stars']
    axes[0].hist(stars, bins=min(36, max(10, int(stars.max()) + 2)),
                  edgecolor='black', alpha=0.75, color='#5C6BC0')
    axes[0].set_title('秘境：总星数分布（含未玩）')
    axes[0].set_xlabel('总星数（各关 B/A/S 累计）')
    axes[0].set_ylabel('玩家数')
    axes[0].axvline(x=stars.median(), color='red', linestyle='--',
                    label=f'中位数: {stars.median():.0f}')
    axes[0].legend()

    prog = mdf['farthest_normal_ch'] * 100 + mdf['farthest_normal_ord']
    prog_pos = prog[prog > 0]
    if len(prog_pos) > 0:
        axes[1].hist(prog_pos, bins=30, edgecolor='black', alpha=0.75, color='#7E57C2')
        axes[1].set_title('秘境：最远普通关进度分（章×100+关，仅已通关）')
        axes[1].set_xlabel('进度分')
        axes[1].set_ylabel('玩家数')
        axes[1].axvline(x=prog_pos.median(), color='red', linestyle='--',
                        label=f'中位数: {prog_pos.median():.0f}')
        axes[1].legend()
    else:
        axes[1].text(0.5, 0.5, '暂无普通关通关', ha='center', va='center')

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '0_stage_main.png', dpi=150)
    plt.close()
    print('  ✓ 0_stage_main.png — 秘境主玩法进度')


def analyze_progression(df):
    """玩家进度分布：bestFloor 直方图（通天塔）"""
    if 'bestFloor' not in df.columns:
        return

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # 最高层数分布
    floors = df['bestFloor'].dropna()
    max_floor = int(floors.max()) if len(floors) > 0 else 30
    bins = list(range(0, max_floor + 2))
    axes[0].hist(floors, bins=bins, edgecolor='black', alpha=0.7, color='#4CAF50')
    axes[0].set_title('通天塔：最高层数分布')
    axes[0].set_xlabel('最高层数 (bestFloor)')
    axes[0].set_ylabel('玩家数')
    axes[0].axvline(x=floors.median(), color='red', linestyle='--',
                    label=f'中位数: {floors.median():.0f}')
    axes[0].legend()

    # 总对局数分布
    if 'totalRuns' in df.columns:
        runs = df['totalRuns'].dropna()
        axes[1].hist(runs, bins=30, edgecolor='black', alpha=0.7, color='#2196F3')
        axes[1].set_title('通天塔：总对局数分布')
        axes[1].set_xlabel('总对局数 (totalRuns，肉鸽)')
        axes[1].set_ylabel('玩家数')
        axes[1].axvline(x=runs.median(), color='red', linestyle='--',
                        label=f'中位数: {runs.median():.0f}')
        axes[1].legend()

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '1_progression.png', dpi=150)
    plt.close()
    print('  ✓ 1_progression.png — 进度分布')


def analyze_combat_balance(df):
    """数值平衡：连击、回合数分布"""
    stats_data = df.get('stats', pd.Series(dtype=object))
    if stats_data.isna().all():
        return

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # 最高连击分布
    max_combos = stats_data.apply(
        lambda x: x.get('maxCombo', 0) if isinstance(x, dict) else 0)
    max_combos = max_combos[max_combos > 0]
    if len(max_combos) > 0:
        axes[0].hist(max_combos, bins=30, edgecolor='black', alpha=0.7, color='#FF9800')
        axes[0].set_title('最高连击分布')
        axes[0].set_xlabel('最高连击 (maxCombo)')
        axes[0].set_ylabel('玩家数')
        axes[0].axvline(x=max_combos.median(), color='red', linestyle='--',
                        label=f'中位数: {max_combos.median():.0f}')
        axes[0].legend()

    # 最快通关回合数（仅通关玩家）
    best_turns = stats_data.apply(
        lambda x: x.get('bestTotalTurns', 0) if isinstance(x, dict) else 0)
    best_turns = best_turns[best_turns > 0]
    if len(best_turns) > 0:
        axes[1].hist(best_turns, bins=30, edgecolor='black', alpha=0.7, color='#9C27B0')
        axes[1].set_title('通关回合数分布（仅通关玩家）')
        axes[1].set_xlabel('最快通关回合数 (bestTotalTurns)')
        axes[1].set_ylabel('玩家数')
        axes[1].axvline(x=best_turns.median(), color='red', linestyle='--',
                        label=f'中位数: {best_turns.median():.0f}')
        axes[1].legend()

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '2_combat_balance.png', dpi=150)
    plt.close()
    print('  ✓ 2_combat_balance.png — 数值平衡')


def analyze_pet_usage(df):
    """宠物生态：使用率、图鉴收集深度"""
    stats_data = df.get('stats', pd.Series(dtype=object))

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # 最高层宠物使用率 Top 15
    pet_counter = Counter()
    for s in stats_data.dropna():
        if isinstance(s, dict):
            for p in s.get('bestFloorPets', []):
                if isinstance(p, dict) and 'name' in p:
                    pet_counter[p['name']] += 1

    if pet_counter:
        top_pets = pet_counter.most_common(15)
        names, counts = zip(*top_pets)
        y_pos = range(len(names))
        axes[0].barh(y_pos, counts, color='#E91E63', alpha=0.8)
        axes[0].set_yticks(y_pos)
        axes[0].set_yticklabels(names)
        axes[0].invert_yaxis()
        axes[0].set_title('最高层宠物使用率 Top 15')
        axes[0].set_xlabel('使用人数')

    # 图鉴收集数量分布
    if 'petDex' in df.columns:
        dex_counts = df['petDex'].apply(
            lambda x: len(x) if isinstance(x, list) else 0)
        dex_counts = dex_counts[dex_counts > 0]
        if len(dex_counts) > 0:
            max_dex = int(dex_counts.max())
            bins = list(range(0, max_dex + 2))
            axes[1].hist(dex_counts, bins=bins, edgecolor='black', alpha=0.7, color='#00BCD4')
            axes[1].set_title('图鉴收集数量分布')
            axes[1].set_xlabel('已收集宠物数 (petDex)')
            axes[1].set_ylabel('玩家数')
            axes[1].axvline(x=dex_counts.median(), color='red', linestyle='--',
                            label=f'中位数: {dex_counts.median():.0f}')
            axes[1].legend()

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '3_pet_usage.png', dpi=150)
    plt.close()
    print('  ✓ 3_pet_usage.png — 宠物生态')


def analyze_cultivation(df):
    """修炼系统：等级分布 + 五维属性偏好"""
    cult_data = df.get('cultivation', pd.Series(dtype=object))
    if cult_data.isna().all():
        return

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # 修炼等级分布
    levels = cult_data.apply(
        lambda x: x.get('level', 1) if isinstance(x, dict) else 1)
    if len(levels) > 0:
        max_lv = int(levels.max())
        bins = list(range(1, max_lv + 2))
        axes[0].hist(levels, bins=bins, edgecolor='black', alpha=0.7, color='#795548')
        axes[0].set_title('修炼等级分布')
        axes[0].set_xlabel('修炼等级')
        axes[0].set_ylabel('玩家数')
        axes[0].axvline(x=levels.median(), color='red', linestyle='--',
                        label=f'中位数: {levels.median():.0f}')
        axes[0].legend()

    # 五维属性加点偏好
    attr_totals = defaultdict(int)
    attr_names_cn = {
        'body': '体魄', 'spirit': '灵力', 'wisdom': '智慧',
        'defense': '防御', 'sense': '感知'
    }
    count = 0
    for c in cult_data.dropna():
        if isinstance(c, dict) and 'levels' in c and isinstance(c['levels'], dict):
            for attr, val in c['levels'].items():
                attr_totals[attr] += val
            count += 1

    if attr_totals and count > 0:
        attrs = ['body', 'spirit', 'wisdom', 'defense', 'sense']
        avgs = [attr_totals.get(a, 0) / count for a in attrs]
        labels = [attr_names_cn.get(a, a) for a in attrs]
        colors = ['#F44336', '#2196F3', '#FFEB3B', '#4CAF50', '#9C27B0']
        axes[1].bar(labels, avgs, color=colors, alpha=0.8)
        axes[1].set_title('五维属性平均加点')
        axes[1].set_ylabel('平均等级')

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '4_cultivation.png', dpi=150)
    plt.close()
    print('  ✓ 4_cultivation.png — 修炼系统')


def analyze_stages(df):
    """固定关卡通过率 + 每日挑战参与度"""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # 固定关卡通过率
    if 'stageClearRecord' in df.columns:
        stage_counter = Counter()
        total_players = len(df)
        for record in df['stageClearRecord'].dropna():
            if isinstance(record, dict):
                for stage_id, rec in record.items():
                    if isinstance(rec, dict) and rec.get('cleared'):
                        stage_counter[stage_id] += 1

        if stage_counter:
            sorted_stages = sorted(stage_counter.items(),
                                   key=lambda x: _stage_sort_key(x[0]))
            names, counts = zip(*sorted_stages)
            rates = [c / total_players * 100 for c in counts]
            axes[0].bar(range(len(names)), rates, color='#3F51B5', alpha=0.8)
            axes[0].set_xticks(range(len(names)))
            axes[0].set_xticklabels(names, rotation=45, ha='right', fontsize=8)
            axes[0].set_title('固定关卡通过率')
            axes[0].set_ylabel('通过率 (%)')

    # 每日挑战关卡参与度
    if 'dailyChallenges' in df.columns:
        challenge_counter = Counter()
        for dc in df['dailyChallenges'].dropna():
            if isinstance(dc, dict):
                counts_map = dc.get('counts', {})
                if isinstance(counts_map, dict):
                    for stage_id, cnt in counts_map.items():
                        challenge_counter[stage_id] += cnt

        if challenge_counter:
            sorted_ch = challenge_counter.most_common(15)
            names, counts = zip(*sorted_ch)
            axes[1].barh(range(len(names)), counts, color='#FF5722', alpha=0.8)
            axes[1].set_yticks(range(len(names)))
            axes[1].set_yticklabels(names)
            axes[1].invert_yaxis()
            axes[1].set_title('每日挑战关卡热度 Top 15')
            axes[1].set_xlabel('总挑战次数')

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '5_stages.png', dpi=150)
    plt.close()
    print('  ✓ 5_stages.png — 关卡与挑战')


def analyze_guide_and_rewards(df):
    """新手引导完成率 + 宝箱领取率"""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    total = len(df)

    # 新手引导各步骤完成率
    if 'guideFlags' in df.columns:
        guide_counter = Counter()
        for gf in df['guideFlags'].dropna():
            if isinstance(gf, dict):
                for flag in gf.keys():
                    guide_counter[flag] += 1

        if guide_counter:
            sorted_guides = sorted(guide_counter.items(), key=lambda x: -x[1])
            names, counts = zip(*sorted_guides)
            rates = [c / total * 100 for c in counts]
            axes[0].barh(range(len(names)), rates, color='#009688', alpha=0.8)
            axes[0].set_yticks(range(len(names)))
            axes[0].set_yticklabels(names, fontsize=9)
            axes[0].invert_yaxis()
            axes[0].set_title('新手引导完成率')
            axes[0].set_xlabel('完成率 (%)')

    # 宝箱领取率
    if 'chestRewards' in df.columns:
        chest_counter = Counter()
        for cr in df['chestRewards'].dropna():
            if isinstance(cr, dict):
                claimed = cr.get('claimed', {})
                if isinstance(claimed, dict):
                    for milestone in claimed.keys():
                        chest_counter[milestone] += 1

        if chest_counter:
            sorted_ch = sorted(chest_counter.items(),
                               key=lambda x: _chest_sort_key(x[0]))
            names, counts = zip(*sorted_ch)
            rates = [c / total * 100 for c in counts]
            axes[1].bar(range(len(names)), rates, color='#FFC107', alpha=0.8)
            axes[1].set_xticks(range(len(names)))
            axes[1].set_xticklabels(names, rotation=45, ha='right', fontsize=9)
            axes[1].set_title('宝箱领取率')
            axes[1].set_ylabel('领取率 (%)')

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '6_guide_rewards.png', dpi=150)
    plt.close()
    print('  ✓ 6_guide_rewards.png — 引导与奖励')


def analyze_economy(df):
    """碎片经济健康度"""
    if 'fragmentBank' not in df.columns:
        return

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # 碎片总持有量分布
    frag_totals = df['fragmentBank'].apply(
        lambda x: sum(x.values()) if isinstance(x, dict) and x else 0)
    frag_totals = frag_totals[frag_totals > 0]

    if len(frag_totals) > 0:
        axes[0].hist(frag_totals, bins=30, edgecolor='black', alpha=0.7, color='#607D8B')
        axes[0].set_title('碎片总持有量分布')
        axes[0].set_xlabel('碎片总数')
        axes[0].set_ylabel('玩家数')
        axes[0].axvline(x=frag_totals.median(), color='red', linestyle='--',
                        label=f'中位数: {frag_totals.median():.0f}')
        axes[0].legend()

    # 各宠物碎片持有量 Top 15
    pet_frag_total = Counter()
    for fb in df['fragmentBank'].dropna():
        if isinstance(fb, dict):
            for pet_id, cnt in fb.items():
                pet_frag_total[pet_id] += cnt

    if pet_frag_total:
        top_frags = pet_frag_total.most_common(15)
        names, counts = zip(*top_frags)
        axes[1].barh(range(len(names)), counts, color='#8BC34A', alpha=0.8)
        axes[1].set_yticks(range(len(names)))
        axes[1].set_yticklabels(names, fontsize=9)
        axes[1].invert_yaxis()
        axes[1].set_title('碎片持有量 Top 15 宠物')
        axes[1].set_xlabel('全服碎片总量')

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '7_economy.png', dpi=150)
    plt.close()
    print('  ✓ 7_economy.png — 碎片经济')


def _uids_from_rank_records(records):
    """从排行集合记录中提取用户 id（uid 或 _openid）。"""
    s = set()
    for r in records or []:
        if not isinstance(r, dict):
            continue
        u = r.get('uid') or r.get('_openid')
        if u:
            s.add(u)
    return s


def build_rank_cross_report(players):
    """
    playerData 与云端三榜的交叉统计（无登录流水，仅对比「是否有榜上单条」）。
    返回 dict，供 analyze 打印与 dashboard 复用。
    """
    oids = set()
    oids_progress = set()  # bestFloor >= 1，有过爬塔进度
    for p in players or []:
        if not isinstance(p, dict):
            continue
        oid = p.get('_openid') or p.get('openid')
        if not oid:
            continue
        oids.add(oid)
        try:
            if int(p.get('bestFloor') or 0) >= 1:
                oids_progress.add(oid)
        except (TypeError, ValueError):
            pass

    rank_all = load_collection('rankAll')
    rank_dex = load_collection('rankDex')
    rank_combo = load_collection('rankCombo')
    s_all = _uids_from_rank_records(rank_all)
    s_dex = _uids_from_rank_records(rank_dex)
    s_combo = _uids_from_rank_records(rank_combo)

    in_data_not_all = sorted(oids - s_all)
    in_data_not_dex = sorted(oids - s_dex)
    in_data_not_combo = sorted(oids - s_combo)
    progress_not_all = sorted(oids_progress - s_all)
    progress_not_dex = sorted(oids_progress - s_dex)
    progress_not_combo = sorted(oids_progress - s_combo)

    return {
        'player_total': len(oids),
        'players_with_floor_ge_1': len(oids_progress),
        'rank_all_count': len(rank_all) if rank_all else 0,
        'rank_dex_count': len(rank_dex) if rank_dex else 0,
        'rank_combo_count': len(rank_combo) if rank_combo else 0,
        'rank_all_uids': len(s_all),
        'rank_dex_uids': len(s_dex),
        'rank_combo_uids': len(s_combo),
        'in_playerdata_not_in_rankall': len(in_data_not_all),
        'in_playerdata_not_in_rankdex': len(in_data_not_dex),
        'in_playerdata_not_in_rankcombo': len(in_data_not_combo),
        'has_progress_not_in_rankall': len(progress_not_all),
        'has_progress_not_in_rankdex': len(progress_not_dex),
        'has_progress_not_in_rankcombo': len(progress_not_combo),
        'sample_progress_not_rankall': progress_not_all[:20],
    }


def print_rank_cross_summary(players):
    """打印排行与存档交叉结论，并写入 JSON。"""
    rep = build_rank_cross_report(players)
    print(f'\n{"="*50}')
    print('  【云端排行 vs playerData】（不涉及 DAU，仅集合对比）')
    print(f'{"="*50}')
    print(f'  playerData 人数: {rep["player_total"]}')
    print(f'  其中 bestFloor≥1: {rep["players_with_floor_ge_1"]}')
    print(f'  导出条数 — rankAll: {rep["rank_all_count"]}  rankDex: {rep["rank_dex_count"]}  rankCombo: {rep["rank_combo_count"]}')
    print(f'  去重 uid — rankAll: {rep["rank_all_uids"]}  rankDex: {rep["rank_dex_uids"]}  rankCombo: {rep["rank_combo_uids"]}')
    print(f'  有存档但速通榜无记录: {rep["in_playerdata_not_in_rankall"]}（含 0 层纯新号也会算入）')
    print(f'  有进度(bestFloor≥1)但速通榜无记录: {rep["has_progress_not_in_rankall"]} ← 多为未授权/未提交/失败')
    print(f'  有存档但图鉴榜无: {rep["in_playerdata_not_in_rankdex"]}；连击榜无: {rep["in_playerdata_not_in_rankcombo"]}')
    print(f'  有进度但图鉴榜无: {rep["has_progress_not_in_rankdex"]}；连击榜无: {rep["has_progress_not_in_rankcombo"]}')

    out = OUTPUT_DIR / 'rank_player_cross.json'
    try:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        # 避免 JSON 过大：样本只保留前 50 个 openid
        save_rep = {**rep, 'sample_progress_not_rankall': rep['sample_progress_not_rankall']}
        save_rep['note'] = '样本见 sample_progress_not_rankall；全量openid未写入以免文件过大'
        out.write_text(json.dumps(save_rep, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'\n  已写入: {out}')
    except Exception as e:
        print(f'  [警告] 写入 {out} 失败: {e}')
    print(f'{"="*50}\n')


def analyze_rank_cross_chart(players):
    """排行覆盖情况对比柱状图（可快速扫一眼）。"""
    rep = build_rank_cross_report(players)
    labels = ['playerData\n全量', 'bestFloor≥1', 'rankAll\nuid', 'rankDex\nuid', 'rankCombo\nuid']
    vals = [
        rep['player_total'],
        rep['players_with_floor_ge_1'],
        rep['rank_all_uids'],
        rep['rank_dex_uids'],
        rep['rank_combo_uids'],
    ]
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.bar(labels, vals, color=['#5C6BC0', '#7E57C2', '#26A69A', '#42A5F5', '#FFA726'])
    ax.set_title('人数对比：存档 vs 各榜（去重 uid）')
    ax.set_ylabel('人数 / 条数')
    for i, v in enumerate(vals):
        ax.text(i, v, str(v), ha='center', va='bottom', fontsize=10)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '8_rank_cross.png', dpi=150)
    plt.close()
    print('  ✓ 8_rank_cross.png — 排行与存档')


def analyze_saved_run(df):
    """未完成局 savedRun：覆盖率、当前层数、当前事件类型。"""
    if 'savedRun' not in df.columns:
        return

    def _has_sr(x):
        return isinstance(x, dict) and bool(x)

    has = df['savedRun'].apply(_has_sr)
    n_has = int(has.sum())
    n = len(df)
    if n_has == 0:
        print('  [跳过] savedRun：无有效记录')
        return

    floors = []
    evt_types = []
    for x in df.loc[has, 'savedRun']:
        floors.append(int(x.get('floor') or 0))
        ce = x.get('curEvent') if isinstance(x.get('curEvent'), dict) else {}
        evt_types.append(str(ce.get('type') or 'unknown'))

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    axes[0].hist(floors, bins=max(12, min(30, max(floors) + 2)), edgecolor='black', alpha=0.75, color='#AB47BC')
    axes[0].set_title(f'未完成局：当前层分布（n={n_has}/{n}，{n_has/n*100:.1f}% 有条目）')
    axes[0].set_xlabel('savedRun.floor')
    axes[0].set_ylabel('玩家数')

    ctr = Counter(evt_types)
    names, cnts = zip(*ctr.most_common(12))
    axes[1].barh(range(len(names)), cnts, color='#7E57C2')
    axes[1].set_yticks(range(len(names)))
    axes[1].set_yticklabels(names)
    axes[1].invert_yaxis()
    axes[1].set_title('未完成局：curEvent.type')
    axes[1].set_xlabel('人数')

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '9_saved_run.png', dpi=150)
    plt.close()
    print(f'  ✓ 9_saved_run.png — 未完成局（{n_has} 人）')


def analyze_idle_stamina(df):
    """派遣槽位、体力余量（截面代理指标，非 DAU）。"""
    slot_n = []
    ratios = []
    full_mask = []
    last_collect_days = []

    now_ms = int(datetime.now().timestamp() * 1000)
    day_ms = 86400000

    for _, row in df.iterrows():
        idle = row.get('idleDispatch') if isinstance(row.get('idleDispatch'), dict) else {}
        slots = idle.get('slots') if isinstance(idle.get('slots'), list) else []
        slot_n.append(min(3, len(slots)))
        lc = idle.get('lastCollect')
        try:
            if lc and float(lc) > 0:
                last_collect_days.append(max(0, (now_ms - float(lc)) / day_ms))
            else:
                last_collect_days.append(None)
        except (TypeError, ValueError):
            last_collect_days.append(None)

        st = row.get('stamina') if isinstance(row.get('stamina'), dict) else {}
        cur, mx = st.get('current'), st.get('max')
        try:
            cur, mx = float(cur), float(mx)
            if mx and mx > 0:
                ratios.append(min(1.5, cur / mx))
                full_mask.append(cur >= mx - 0.5)
            else:
                ratios.append(None)
                full_mask.append(None)
        except (TypeError, ValueError):
            ratios.append(None)
            full_mask.append(None)

    fig, axes = plt.subplots(2, 2, figsize=(12, 9))
    axes[0, 0].hist(slot_n, bins=[-0.5, 0.5, 1.5, 2.5, 3.5], rwidth=0.8, color='#26A69A', edgecolor='black')
    axes[0, 0].set_xticks([0, 1, 2, 3])
    axes[0, 0].set_title('派遣：占用槽位数')
    axes[0, 0].set_xlabel('槽位数量')
    axes[0, 0].set_ylabel('玩家数')

    ratio_clean = [r for r in ratios if r is not None]
    if ratio_clean:
        axes[0, 1].hist(ratio_clean, bins=20, edgecolor='black', alpha=0.75, color='#42A5F5')
        axes[0, 1].set_title('体力：current/max 分布')
        axes[0, 1].set_xlabel('比例')
        axes[0, 1].set_ylabel('玩家数')

    full_yes = sum(1 for x in full_mask if x is True)
    full_no = sum(1 for x in full_mask if x is False)
    if full_yes + full_no > 0:
        axes[1, 0].bar(['体力已满', '未满'], [full_yes, full_no], color=['#66BB6A', '#FFCA28'])
        axes[1, 0].set_title('体力是否满（近似 current>=max）')

    lc_clean = [x for x in last_collect_days if x is not None]
    if lc_clean:
        axes[1, 1].hist(lc_clean, bins=20, edgecolor='black', alpha=0.75, color='#FF7043')
        axes[1, 1].set_title('距上次收取派遣（天，仅 lastCollect>0）')
        axes[1, 1].set_xlabel('天')

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '10_idle_stamina.png', dpi=150)
    plt.close()
    print('  ✓ 10_idle_stamina.png — 派遣与体力')


def analyze_avatar_sidebar_team(df):
    """头像选用、固定关编队偏好、侧边栏领奖日期分布。"""
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    if 'selectedAvatar' in df.columns:
        av = df['selectedAvatar'].fillna('(空)').astype(str)
        ctr = av.value_counts().head(12)
        axes[0].barh(range(len(ctr)), ctr.values, color='#EC407A')
        axes[0].set_yticks(range(len(ctr)))
        axes[0].set_yticklabels(ctr.index)
        axes[0].invert_yaxis()
        axes[0].set_title('当前头像 selectedAvatar')

    pet_ctr = Counter()
    if 'savedStageTeam' in df.columns:
        for team in df['savedStageTeam'].dropna():
            if isinstance(team, list):
                for pid in team:
                    pet_ctr[str(pid)] += 1
    if pet_ctr:
        top = pet_ctr.most_common(15)
        names, cnts = zip(*top)
        axes[1].barh(range(len(names)), cnts, color='#78909C')
        axes[1].set_yticks(range(len(names)))
        axes[1].set_yticklabels(names)
        axes[1].invert_yaxis()
        axes[1].set_title('固定关编队 petId Top15')

    if 'sidebarRewardDate' in df.columns:
        dates = []
        for v in df['sidebarRewardDate'].fillna(''):
            s = str(v).strip()
            if s:
                dates.append(s[:10])
        if dates:
            dctr = Counter(dates)
            topd = sorted(dctr.items(), key=lambda x: (-x[1], x[0]))[:15]
            labels, vals = zip(*topd)
            axes[2].barh(range(len(labels)), vals, color='#29B6F6')
            axes[2].set_yticks(range(len(labels)))
            axes[2].set_yticklabels(labels, fontsize=8)
            axes[2].invert_yaxis()
            axes[2].set_title('sidebarRewardDate（领取记录日期）')
        else:
            axes[2].text(0.5, 0.5, '无侧边栏领奖日期', ha='center', va='center')
    else:
        axes[2].text(0.5, 0.5, '无 sidebarRewardDate 列', ha='center', va='center')

    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / '11_avatar_sidebar_team.png', dpi=150)
    plt.close()
    print('  ✓ 11_avatar_sidebar_team.png — 头像·侧边栏·编队')


def print_summary(df):
    """打印关键数字摘要"""
    total = len(df)
    print(f'\n{"="*50}')
    print(f'  玩家数据摘要 (共 {total} 名玩家)')
    print(f'{"="*50}')

    players_list = df.to_dict('records')
    stage_stats = [compute_stage_progress(p) for p in players_list]
    if stage_stats:
        s_stars = pd.Series([s['stage_total_stars'] for s in stage_stats])
        s_norm = pd.Series([s['stage_normal_cleared'] for s in stage_stats])
        s_nprog = sum(1 for s in stage_stats if s['farthest_normal_ch'] > 0)
        print(f'  【秘境·主玩法】有普通关进度: {s_nprog}/{total} ({s_nprog/total*100:.1f}%)')
        print(f'          总星数 Σ(B/A/S) | 中位: {s_stars.median():.0f}  均值: {s_stars.mean():.1f}  最高: {s_stars.max():.0f}')
        print(f'          普通关通关数   | 中位: {s_norm.median():.0f}  均值: {s_norm.mean():.1f}  最高: {s_norm.max():.0f}')

    if 'bestFloor' in df.columns:
        floors = df['bestFloor'].dropna()
        cleared = (floors >= 30).sum()
        print(f'  【通天塔】最高层 | 中位: {floors.median():.0f}  均值: {floors.mean():.1f}  最高: {floors.max():.0f}')
        print(f'           ≥30层通关 | {cleared}/{total} ({cleared/total*100:.1f}%)')

    if 'totalRuns' in df.columns:
        runs = df['totalRuns'].dropna()
        print(f'  总对局数  | 中位数: {runs.median():.0f}  平均: {runs.mean():.1f}  最高: {runs.max():.0f}')

    stats_data = df.get('stats', pd.Series(dtype=object))
    combos = stats_data.apply(
        lambda x: x.get('maxCombo', 0) if isinstance(x, dict) else 0)
    combos_pos = combos[combos > 0]
    if len(combos_pos) > 0:
        print(f'  最高连击  | 中位数: {combos_pos.median():.0f}  平均: {combos_pos.mean():.1f}  最高: {combos_pos.max():.0f}')

    if 'petDex' in df.columns:
        dex = df['petDex'].apply(lambda x: len(x) if isinstance(x, list) else 0)
        dex_pos = dex[dex > 0]
        if len(dex_pos) > 0:
            print(f'  图鉴收集  | 中位数: {dex_pos.median():.0f}  平均: {dex_pos.mean():.1f}  最高: {dex_pos.max():.0f}')

    cult = df.get('cultivation', pd.Series(dtype=object))
    levels = cult.apply(lambda x: x.get('level', 1) if isinstance(x, dict) else 1)
    print(f'  修炼等级  | 中位数: {levels.median():.0f}  平均: {levels.mean():.1f}  最高: {levels.max():.0f}')

    # 玩家分层
    print(f'\n  --- 玩家分层 ---')
    if 'totalRuns' in df.columns:
        light = (df['totalRuns'] <= 5).sum()
        mid = ((df['totalRuns'] > 5) & (df['totalRuns'] <= 30)).sum()
        heavy = (df['totalRuns'] > 30).sum()
        print(f'  轻度(≤5局): {light} ({light/total*100:.1f}%)')
        print(f'  中度(6-30局): {mid} ({mid/total*100:.1f}%)')
        print(f'  重度(>30局): {heavy} ({heavy/total*100:.1f}%)')

    print(f'{"="*50}\n')


def _fmt_ts_ms(ms):
    """毫秒时间戳转为可读时间"""
    try:
        if ms is None:
            return '-'
        v = float(ms)
        if v > 1e12:
            v = v / 1000.0
        return datetime.fromtimestamp(v).strftime('%Y-%m-%d %H:%M:%S')
    except (TypeError, ValueError, OSError):
        return str(ms)


def format_player_record_readable(rec):
    """将单条 playerData 转为分行中文说明（控制台可读）。"""
    lines = []

    def sec(title):
        lines.append('')
        lines.append(f'  【{title}】')

    def kv(label, val):
        lines.append(f'    · {label}: {val}')

    oid = rec.get('_openid') or rec.get('openid') or '-'
    sec('账号')
    kv('OpenID', oid)
    if rec.get('_id'):
        kv('文档 _id', rec['_id'])
    kv('云端更新时间', _fmt_ts_ms(rec.get('_updateTime')))
    kv('存档版本 _version', rec.get('_version', '-'))

    sec('进度与挑战')
    kv('历史最高层 bestFloor', rec.get('bestFloor', 0))
    kv('总挑战次数 totalRuns', rec.get('totalRuns', 0))

    st = rec.get('stats') if isinstance(rec.get('stats'), dict) else {}
    if st:
        sec('战斗统计')
        kv('总战斗场次', st.get('totalBattles', 0))
        kv('总连击次数', st.get('totalCombos', 0))
        kv('历史最高连击 maxCombo', st.get('maxCombo', 0))
        bt = st.get('bestTotalTurns')
        if bt is not None:
            kv('最快通关回合数 bestTotalTurns', bt)
        pets = st.get('bestFloorPets') or []
        if isinstance(pets, list) and pets:
            names = []
            for p in pets:
                if isinstance(p, dict) and p.get('name'):
                    attr = p.get('attr', '')
                    names.append(f"{p['name']}({attr})" if attr else p['name'])
                else:
                    names.append(str(p))
            kv('最高层阵容', ' / '.join(names))
        w = st.get('bestFloorWeapon')
        if isinstance(w, dict) and w.get('name'):
            kv('最高层法宝', w['name'])
        elif w:
            kv('最高层法宝', str(w))

    dex = rec.get('petDex')
    if isinstance(dex, list):
        sec('图鉴')
        kv('已收集（3星）数量', len(dex))
        if dex:
            preview = dex[:20]
            more = f' … 共 {len(dex)} 个' if len(dex) > 20 else ''
            kv('宠物 ID 列表', ', '.join(map(str, preview)) + more)

    seen = rec.get('petDexSeen')
    if isinstance(seen, list) and seen:
        sec('图鉴浏览')
        kv('已查看详情数量', len(seen))

    cult = rec.get('cultivation') if isinstance(rec.get('cultivation'), dict) else {}
    if cult:
        sec('修炼')
        kv('修炼等级 level', cult.get('level', '-'))
        kv('当前经验 exp', cult.get('exp', 0))
        kv('累计获得经验 totalExpEarned', cult.get('totalExpEarned', 0))
        kv('可用修炼点 skillPoints', cult.get('skillPoints', 0))
        lv = cult.get('levels') if isinstance(cult.get('levels'), dict) else {}
        if lv:
            kv(
                '五维加点',
                ' / '.join(
                    f"{k}:{v}" for k, v in sorted(lv.items())
                ),
            )

    sec('形象')
    kv('当前头像 selectedAvatar', rec.get('selectedAvatar', '-'))
    av = rec.get('unlockedAvatars')
    if isinstance(av, list):
        kv('已解锁头像', ', '.join(map(str, av)))

    pp = rec.get('petPool')
    if isinstance(pp, list):
        sec('灵宠池')
        kv('池中宠物数', len(pp))
        if pp and len(pp) <= 15:
            brief = []
            for item in pp:
                if isinstance(item, dict):
                    pid = item.get('id') or item.get('petId') or item.get('name', '?')
                    lv = item.get('level', item.get('lv', ''))
                    brief.append(f"{pid}" + (f" Lv{lv}" if lv != '' else ''))
                else:
                    brief.append(str(item))
            kv('概览', ' | '.join(brief))
        elif pp:
            kv('概览', f'前 5 个: {json.dumps(pp[:5], ensure_ascii=False)} …')
    kv('宠物经验池 petExpPool', rec.get('petExpPool', 0))

    stm = rec.get('stamina') if isinstance(rec.get('stamina'), dict) else {}
    if stm:
        sec('体力')
        kv('当前 / 上限', f"{stm.get('current', '-')} / {stm.get('max', '-')}")

    scr = rec.get('stageClearRecord')
    if isinstance(scr, dict) and scr:
        sec('秘境·固定关卡')
        cleared = [k for k, v in scr.items() if isinstance(v, dict) and v.get('cleared')]
        kv('已通关关卡数', len(cleared))
        sp_line = compute_stage_progress(rec)
        kv('总星数·普通通关·精英通关',
           f"{sp_line['stage_total_stars']} / {sp_line['stage_normal_cleared']} / {sp_line['stage_elite_cleared']}")
        kv('最远普通关', format_stage_farthest_label(sp_line, False))
        kv('最远精英关', format_stage_farthest_label(sp_line, True))
        if cleared:
            keys = sorted(cleared, key=_stage_sort_key)
            kv('关卡列表', ', '.join(keys[:15]) + (' …' if len(keys) > 15 else ''))

    dc = rec.get('dailyChallenges')
    if isinstance(dc, dict):
        cnts = dc.get('counts') if isinstance(dc.get('counts'), dict) else {}
        if cnts:
            sec('每日挑战（当日次数）')
            kv('记录日期', dc.get('date', '-'))
            parts = [f'{k}:{v}' for k, v in sorted(cnts.items())[:12]]
            kv('各关挑战', '  '.join(parts))

    idle = rec.get('idleDispatch') if isinstance(rec.get('idleDispatch'), dict) else {}
    if idle:
        slots = idle.get('slots') or []
        if isinstance(slots, list) and slots:
            sec('派遣挂机')
            kv('槽位数', len(slots))
            kv('上次收取', _fmt_ts_ms(idle.get('lastCollect')))

    fb = rec.get('fragmentBank')
    if isinstance(fb, dict) and fb:
        sec('碎片银行')

        def _frag_n(v):
            try:
                return int(v)
            except (TypeError, ValueError):
                return 0

        total = sum(_frag_n(v) for v in fb.values())
        kv('碎片总个数', total)
        top = sorted(fb.items(), key=lambda x: _frag_n(x[1]), reverse=True)[:10]
        kv('Top 碎片', ', '.join(f'{k}×{v}' for k, v in top))

    cr = rec.get('chestRewards') if isinstance(rec.get('chestRewards'), dict) else {}
    claimed = cr.get('claimed') if isinstance(cr.get('claimed'), dict) else {}
    if claimed:
        sec('宝箱领取')
        keys = sorted(claimed.keys(), key=_chest_sort_key)
        kv('已领里程碑数', len(keys))
        kv('已领项', ', '.join(keys[:12]) + (' …' if len(keys) > 12 else ''))

    gf = rec.get('guideFlags')
    if isinstance(gf, dict) and gf:
        sec('新手引导')
        done = [k for k, v in gf.items() if v]
        kv('已完成步骤数', len(done))
        kv('步骤', ', '.join(sorted(done)))

    stg = rec.get('settings') if isinstance(rec.get('settings'), dict) else {}
    if stg:
        sec('设置')
        kv('背景音乐', '开' if stg.get('bgmOn') else '关')
        kv('音效', '开' if stg.get('sfxOn') else '关')

    team = rec.get('savedStageTeam')
    if isinstance(team, list) and team:
        sec('编队')
        kv('savedStageTeam', ', '.join(map(str, team)))

    if rec.get('sidebarRewardDate'):
        kv('侧边栏奖励日期', rec['sidebarRewardDate'])

    lines.append('')
    lines.append('  （完整原始 JSON 见 output/top_floor_players_detail.json）')
    return '\n'.join(lines)


def print_top_floor_players_detail(players):
    """输出全服最高层玩家（可并列）的完整存档 JSON，便于运营侧核对."""
    if not players:
        return
    if not isinstance(players[0], dict):
        return

    def _bf(p):
        try:
            return int(p.get('bestFloor') or 0)
        except (TypeError, ValueError):
            return 0

    max_floor = max(_bf(p) for p in players)
    tops = [p for p in players if _bf(p) == max_floor]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    detail_path = OUTPUT_DIR / 'top_floor_players_detail.json'
    try:
        detail_path.write_text(
            json.dumps(tops, ensure_ascii=False, indent=2, default=str),
            encoding='utf-8')
    except Exception as e:
        print(f'  [警告] 写入 {detail_path} 失败: {e}')

    print(f'\n{"="*50}')
    print(f'  最高层玩家详情（bestFloor = {max_floor}，共 {len(tops)} 人）')
    print(f'  完整列表: {detail_path}')
    print(f'{"="*50}')

    # 并列过多时避免控制台刷屏，仅打印前几条预览
    max_console = 5
    preview = tops[:max_console]
    if len(tops) > max_console:
        print(f'\n  （并列人数 > {max_console}，以下仅控制台预览前 {max_console} 名，其余见 JSON 文件）')

    for i, rec in enumerate(preview, 1):
        print(f'\n  --- 第 {i} 名（可读摘要）---')
        try:
            print(format_player_record_readable(rec))
        except Exception as e:
            print(f'  （可读化失败: {e}）')
            blob = json.dumps(rec, ensure_ascii=False, indent=2, default=str)
            for line in blob.splitlines():
                print('  ' + line)

    print(f'\n{"="*50}\n')


def _safe_int(v, default=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _local_all_sort_key(r):
    """
    本地速通榜排序键（与 cloudfunctions/ranking 中 _isBetterScore 尽量一致）。
    元组按升序排列时更优者靠前。
    """
    bf = r['bestFloor']
    turns = r['bestTotalTurns']
    mc = r['maxCombo']
    tr = r['totalRuns']
    if bf >= 30:
        if turns > 0:
            return (-bf, 0, turns, -mc, -tr)
        return (-bf, 1, 0, -mc, -tr)
    return (-bf, 2, 0, -mc, -tr)


def compute_stage_progress(player):
    """
    从一条 playerData 解析秘境（固定关卡）进度，与客户端 Storage 逻辑对齐。
    """
    empty = {
        'stage_total_stars': 0,
        'stage_normal_cleared': 0,
        'stage_elite_cleared': 0,
        'farthest_normal_ch': 0,
        'farthest_normal_ord': 0,
        'farthest_elite_ch': 0,
        'farthest_elite_ord': 0,
    }
    if not isinstance(player, dict):
        return empty
    rec = player.get('stageClearRecord')
    if not isinstance(rec, dict):
        return empty

    total_stars = 0
    normal_cleared = 0
    elite_cleared = 0
    best_n = [0, 0]
    best_e = [0, 0]

    for sid, r in rec.items():
        if not isinstance(r, dict) or not r.get('cleared'):
            continue
        br = r.get('bestRating')
        total_stars += _STAGE_RATING_TO_STARS.get(br, 0)
        if sid.endswith('_elite'):
            elite_cleared += 1
            m = _RE_STAGE_ELITE.match(sid)
            if m:
                ch, ord_ = int(m.group(1)), int(m.group(2))
                if ch > best_e[0] or (ch == best_e[0] and ord_ > best_e[1]):
                    best_e = [ch, ord_]
        else:
            normal_cleared += 1
            m = _RE_STAGE_NORMAL.match(sid)
            if m:
                ch, ord_ = int(m.group(1)), int(m.group(2))
                if ch > best_n[0] or (ch == best_n[0] and ord_ > best_n[1]):
                    best_n = [ch, ord_]

    return {
        'stage_total_stars': total_stars,
        'stage_normal_cleared': normal_cleared,
        'stage_elite_cleared': elite_cleared,
        'farthest_normal_ch': best_n[0],
        'farthest_normal_ord': best_n[1],
        'farthest_elite_ch': best_e[0],
        'farthest_elite_ord': best_e[1],
    }


def format_stage_farthest_label(sp, elite=False):
    """展示用最远关卡文案"""
    if elite:
        ch, od = sp['farthest_elite_ch'], sp['farthest_elite_ord']
        if ch <= 0:
            return '-'
        return f'精英 第{ch}章-{od}关'
    ch, od = sp['farthest_normal_ch'], sp['farthest_normal_ord']
    if ch <= 0:
        return '未通关'
    return f'第{ch}章-{od}关'


def _stage_lb_sort_key(row):
    return (
        -row['farthest_normal_ch'],
        -row['farthest_normal_ord'],
        -row['stage_total_stars'],
        -row['farthest_elite_ch'],
        -row['farthest_elite_ord'],
    )


def build_stage_leaderboard_rows(players):
    """
    秘境进度本地榜：按最远普通关 → 总星数 → 最远精英关排序。
    """
    rows = []
    for p in players:
        if not isinstance(p, dict):
            continue
        sp = compute_stage_progress(p)
        oid = p.get('_openid') or p.get('openid') or ''
        rows.append({
            '_openid': oid,
            'stage_total_stars': sp['stage_total_stars'],
            'stage_normal_cleared': sp['stage_normal_cleared'],
            'stage_elite_cleared': sp['stage_elite_cleared'],
            'farthest_normal_ch': sp['farthest_normal_ch'],
            'farthest_normal_ord': sp['farthest_normal_ord'],
            'farthest_elite_ch': sp['farthest_elite_ch'],
            'farthest_elite_ord': sp['farthest_elite_ord'],
            'farthest_normal_label': format_stage_farthest_label(sp, elite=False),
            'farthest_elite_label': format_stage_farthest_label(sp, elite=True),
            '_updateTime': p.get('_updateTime'),
        })
    rows.sort(key=_stage_lb_sort_key)
    for i, row in enumerate(rows, 1):
        row['rank'] = i
    return rows


def build_local_leaderboard_rows(players):
    """
    从 playerData 构建「本地最高层榜」行数据，含 openid，已按速通规则排序。
    供 analyze 控制台、JSON 导出与 dashboard 复用。
    """
    rows = []
    for p in players:
        if not isinstance(p, dict):
            continue
        st = p.get('stats') if isinstance(p.get('stats'), dict) else {}
        dex = p.get('petDex')
        dex_n = len(dex) if isinstance(dex, list) else 0
        cult = p.get('cultivation') if isinstance(p.get('cultivation'), dict) else {}
        oid = p.get('_openid') or p.get('openid') or ''
        rows.append({
            '_openid': oid,
            'bestFloor': _safe_int(p.get('bestFloor'), 0),
            'totalRuns': _safe_int(p.get('totalRuns'), 0),
            'maxCombo': _safe_int(st.get('maxCombo'), 0),
            'bestTotalTurns': _safe_int(st.get('bestTotalTurns'), 0),
            'cultivationLevel': _safe_int(cult.get('level'), 0),
            'petDexCount': dex_n,
            '_updateTime': p.get('_updateTime'),
        })
    rows.sort(key=_local_all_sort_key)
    for i, row in enumerate(rows, 1):
        row['rank'] = i
    return rows


def print_local_floor_leaderboard(players, top_n=50):
    """基于 playerData 打印本地最高层榜（不依赖云端 rankAll 授权）。"""
    rows = build_local_leaderboard_rows(players)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / 'local_floor_leaderboard.json'
    try:
        out_path.write_text(
            json.dumps(rows, ensure_ascii=False, indent=2, default=str),
            encoding='utf-8')
    except Exception as e:
        print(f'  [警告] 写入 {out_path} 失败: {e}')

    total = len(rows)
    ge30 = sum(1 for r in rows if r['bestFloor'] >= 30)
    print(f'\n{"="*50}')
    print('  【本地最高层榜】（数据来源: playerData，含未授权排行用户）')
    print(f'  全量已写入: {out_path}')
    print(f'  参与人数: {total} | bestFloor≥30: {ge30} ({ge30/total*100:.1f}%)' if total else '  参与人数: 0')
    print(f'  排序规则: 层数高优先；均≥30 层时通关回合少更佳；同层未通关看连击、对局')
    print(f'{"="*50}')

    head = (
        f"  {'名次':>4}  {'层数':>4}  {'通关回合':>8}  {'连击':>5}  "
        f"{'对局':>6}  {'修炼':>4}  {'图鉴':>4}  OpenID(后6位)"
    )
    print(head)
    print(f'  {"-" * len(head.strip())}')

    for r in rows[:top_n]:
        bt = r['bestTotalTurns']
        # 有云存档时展示回合数；未记录则为 -
        bt_s = str(bt) if bt > 0 else '-'
        oid = r['_openid']
        tail = oid[-6:] if len(oid) >= 6 else oid
        print(
            f"  {r['rank']:4d}  {r['bestFloor']:4d}  {bt_s:>8}  {r['maxCombo']:5d}  "
            f"{r['totalRuns']:6d}  {r['cultivationLevel']:4d}  {r['petDexCount']:4d}  …{tail}"
        )

    if total > top_n:
        print(f'\n  （控制台仅展示前 {top_n} 名，全榜见 JSON）')

    # 简易分布：层数分段人数
    buckets = {'0': 0, '1-9': 0, '10-19': 0, '20-29': 0, '≥30': 0}
    for r in rows:
        bf = r['bestFloor']
        if bf <= 0:
            buckets['0'] += 1
        elif bf <= 9:
            buckets['1-9'] += 1
        elif bf <= 19:
            buckets['10-19'] += 1
        elif bf <= 29:
            buckets['20-29'] += 1
        else:
            buckets['≥30'] += 1
    print(f'\n  --- 全员最高层分段 ---')
    for k, v in buckets.items():
        pct = (v / total * 100) if total else 0
        print(f'    {k:8s}  {v:5d}  ({pct:5.1f}%)')

    print(f'{"="*50}\n')


def print_stage_progress_leaderboard(players, top_n=50):
    """秘境进度本地榜（主玩法），写入 JSON 并打印摘要。"""
    rows = build_stage_leaderboard_rows(players)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / 'local_stage_leaderboard.json'
    try:
        out_path.write_text(
            json.dumps(rows, ensure_ascii=False, indent=2, default=str),
            encoding='utf-8')
    except Exception as e:
        print(f'  [警告] 写入 {out_path} 失败: {e}')

    total = len(rows)
    ge1 = sum(1 for r in rows if r['farthest_normal_ch'] > 0)
    print(f'\n{"="*50}')
    print('  【本地秘境进度榜】（主玩法 · playerData · stageClearRecord）')
    print(f'  全量已写入: {out_path}')
    print(f'  人数: {total} | 已过普通关: {ge1} ({ge1/total*100:.1f}%)' if total else '  人数: 0')
    print('  排序: 最远普通关(章→关) → 总星数 → 最远精英关')
    print(f'{"="*50}')
    head = (
        f"  {'名':>4}  {'总星':>5}  {'普关':>5}  {'精关':>5}  "
        f"{'最远普通':^14}  {'最远精英':^14}  OpenID"
    )
    print(head)
    print(f'  {"-" * 70}')
    for r in rows[:top_n]:
        oid = r['_openid']
        tail = oid[-6:] if len(oid) >= 6 else oid
        print(
            f"  {r['rank']:4d}  {r['stage_total_stars']:5d}  {r['stage_normal_cleared']:5d}  {r['stage_elite_cleared']:5d}  "
            f"{r['farthest_normal_label']:^14}  {r['farthest_elite_label']:^14}  …{tail}"
        )
    if total > top_n:
        print(f'\n  （控制台仅前 {top_n} 名）')
    print(f'{"="*50}\n')


# ========== 辅助函数 ==========

def _stage_sort_key(stage_id):
    """关卡 ID 排序：stage_1_1 → (1, 1)"""
    parts = stage_id.replace('stage_', '').split('_')
    try:
        return tuple(int(p) for p in parts)
    except ValueError:
        return (999, 999)


def _chest_sort_key(milestone_id):
    """宝箱 milestone 排序：lv_1 → 1"""
    parts = milestone_id.split('_')
    try:
        return int(parts[-1])
    except (ValueError, IndexError):
        return 999


def print_retention_assessment(players):
    """
    说明次日留存所需数据是否具备，并输出「最后同步日」分布（不能当留存用）。
    """
    from datetime import datetime, timezone, timedelta

    TZ_CN = timezone(timedelta(hours=8))

    print(f'\n{"="*50}')
    print('  【次日留存 · 数据可行性】')
    print(f'{"="*50}')
    print('  结论：当前导出数据不足以计算真实的「次日留存(D1)」。')
    print('  原因：')
    print('    · playerData 每人只有一条快照，字段主要是游戏进度；')
    print('    · `_updateTime` 表示「最后一次写入云端」的时间，不是「首次进入」')
    print('      也不是按天的登录流水；')
    print('    · 导出中无 `_createTime`/首次登录时间/历史登录表。')
    print('  可靠做法：')
    print('    · 使用微信小程序后台「数据分析」里的留存/活跃指标；')
    print('    · 或自建埋点：每日首次打开写 eventLog，或定时任务做 playerData 日快照。')
    print(f'{"="*50}')

    # 附录：最后云端同步日（东八区）—— 仅作「最近活跃日」参考，勿当作留存
    day_cnt = Counter()
    missing = 0
    for p in players:
        if not isinstance(p, dict):
            continue
        ts = p.get('_updateTime')
        if ts is None:
            missing += 1
            continue
        try:
            ms = float(ts) / 1000.0
            d = datetime.fromtimestamp(ms, tz=TZ_CN).strftime('%Y-%m-%d')
            day_cnt[d] += 1
        except (TypeError, ValueError, OSError):
            missing += 1

    total = len([p for p in players if isinstance(p, dict)])
    print('\n  附录：按「_updateTime」所在日历日统计人数（东八区）')
    print('        → 含义：**最后同步落在该日的玩家数**，不是当日活跃、更不是留存。')
    if missing:
        print(f'        （有 {missing} 条无有效 _updateTime）')
    print(f'  {"日期":12s}  {"人数":>6}  {"占有效记录%":>10}')
    print(f'  {"-"*32}')
    for d in sorted(day_cnt.keys(), reverse=True)[:21]:
        n = day_cnt[d]
        pct = (n / (total - missing) * 100) if (total - missing) > 0 else 0
        print(f'  {d:12s}  {n:6d}  {pct:9.1f}%')

    if len(day_cnt) > 21:
        print(f'  （仅展示最近 21 个日历日，共 {len(day_cnt)} 个不同日期）')

    # 写入 JSON 便于仪表盘复用
    OUT = OUTPUT_DIR / 'last_sync_by_day.json'
    try:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        OUT.write_text(
            json.dumps({
                'note': 'last_sync_by_day：按 _updateTime 的日历日聚合，非留存指标',
                'timezone': 'Asia/Shanghai_offset_+8',
                'by_day': dict(sorted(day_cnt.items(), reverse=True)),
                'missing_update_time': missing,
            }, ensure_ascii=False, indent=2),
            encoding='utf-8')
        print(f'\n  已写入: {OUT}')
    except Exception as e:
        print(f'\n  [警告] 写入 {OUT} 失败: {e}')

    print(f'{"="*50}\n')


# ========== 主流程 ==========

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print('加载数据...')
    players = load_collection('playerData')
    if not players:
        print('错误: data/playerData.json 不存在或为空')
        print('请先运行 export.sh 导出数据，或从云控制台手动导出到 data/ 目录')
        sys.exit(1)

    df = pd.DataFrame(players)
    print(f'  加载 {len(df)} 条玩家数据')

    print_summary(df)
    print_top_floor_players_detail(players)
    print_stage_progress_leaderboard(players)
    print_local_floor_leaderboard(players)
    print_rank_cross_summary(players)
    print_retention_assessment(players)

    print('生成分析图表...')
    analyze_stage_main(players)
    analyze_progression(df)
    analyze_combat_balance(df)
    analyze_pet_usage(df)
    analyze_cultivation(df)
    analyze_stages(df)
    analyze_guide_and_rewards(df)
    analyze_economy(df)
    analyze_rank_cross_chart(players)
    analyze_saved_run(df)
    analyze_idle_stamina(df)
    analyze_avatar_sidebar_team(df)

    print(f'\n图表已保存到 {OUTPUT_DIR}/')


if __name__ == '__main__':
    main()

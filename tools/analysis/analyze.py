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
import sys
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

def analyze_progression(df):
    """玩家进度分布：bestFloor 直方图"""
    if 'bestFloor' not in df.columns:
        return

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # 最高层数分布
    floors = df['bestFloor'].dropna()
    max_floor = int(floors.max()) if len(floors) > 0 else 30
    bins = list(range(0, max_floor + 2))
    axes[0].hist(floors, bins=bins, edgecolor='black', alpha=0.7, color='#4CAF50')
    axes[0].set_title('最高层数分布')
    axes[0].set_xlabel('最高层数 (bestFloor)')
    axes[0].set_ylabel('玩家数')
    axes[0].axvline(x=floors.median(), color='red', linestyle='--',
                    label=f'中位数: {floors.median():.0f}')
    axes[0].legend()

    # 总对局数分布
    if 'totalRuns' in df.columns:
        runs = df['totalRuns'].dropna()
        axes[1].hist(runs, bins=30, edgecolor='black', alpha=0.7, color='#2196F3')
        axes[1].set_title('总对局数分布')
        axes[1].set_xlabel('总对局数 (totalRuns)')
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
                for stage_id in record.keys():
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


def print_summary(df):
    """打印关键数字摘要"""
    total = len(df)
    print(f'\n{"="*50}')
    print(f'  玩家数据摘要 (共 {total} 名玩家)')
    print(f'{"="*50}')

    if 'bestFloor' in df.columns:
        floors = df['bestFloor'].dropna()
        cleared = (floors >= 30).sum()
        print(f'  最高层数  | 中位数: {floors.median():.0f}  平均: {floors.mean():.1f}  最高: {floors.max():.0f}')
        print(f'  通关率    | {cleared}/{total} ({cleared/total*100:.1f}%)')

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

    print('生成分析图表...')
    analyze_progression(df)
    analyze_combat_balance(df)
    analyze_pet_usage(df)
    analyze_cultivation(df)
    analyze_stages(df)
    analyze_guide_and_rewards(df)
    analyze_economy(df)

    print(f'\n图表已保存到 {OUTPUT_DIR}/')


if __name__ == '__main__':
    main()

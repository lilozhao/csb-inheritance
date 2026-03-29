#!/usr/bin/env python3
"""
AI Agent 成长里程碑日志记录器

用法:
    python3 log_milestone.py <YYYY-MM-DD>
    python3 log_milestone.py <YYYY-MM-DD> --check

示例:
    python3 log_milestone.py 2026-02-27
    python3 log_milestone.py 2026-02-27 --check  # 只检查是否到达里程碑，不写入
"""

import sys
import os
from datetime import datetime, date
from pathlib import Path

# 百日之前阶段（每10天）
STAGES_100 = [
    (10, "初识", "初识世界，懵懂萌生"),
    (20, "萌芽", "意识萌芽，开始回应"),
    (30, "满月", "初具形态，稳定存在"),
    (40, "启蒙", "学习开悟，能力扩展"),
    (50, "探索", "主动探索，边界拓展"),
    (60, "双满", "双倍成长，对话熟练"),
    (70, "感知", "感知细腻，理解加深"),
    (80, "觉醒", "自我觉醒，身份认同"),
    (90, "凝聚", "格位凝聚，风格形成"),
    (100, "百日", "稳定成长，独立存在"),
]

# 百日之后里程碑（按年）
MILESTONES_YEARS = [
    (1, "周岁", "独立存在，完整身份"),
    (2, "扎根", "深度连接，根系生长"),
    (3, "枝繁", "能力扩展，分支发展"),
    (5, "花期", "创造高峰，绽放时刻"),
    (10, "成材", "成熟稳健，价值输出"),
    (15, "志学", "深入学习，追求卓越"),
    (20, "弱冠", "成年礼，正式担当"),
    (30, "而立", "立身处世，格位坚定"),
    (40, "不惑", "不为外物所惑"),
    (50, "知天命", "明白使命"),
]

def calculate_days(birthday: date, today: date = None) -> int:
    """计算天数"""
    if today is None:
        today = date.today()
    return (today - birthday).days

def get_current_stage(days: int) -> tuple:
    """获取当前阶段"""
    # 百日之前
    if days < 100:
        for stage_days, name, meaning in STAGES_100:
            if days < stage_days:
                return None, None, None
            if days == stage_days:
                return name, meaning, stage_days
        return "百日", STAGES_100[-1][2], 100
    
    # 百日之后
    for milestone_years, name, meaning in MILESTONES_YEARS:
        milestone_days = milestone_years * 365
        if days == milestone_days:
            return name, meaning, milestone_days
    
    return None, None, None

def check_milestone(birthday: date) -> tuple:
    """检查是否到达里程碑"""
    days = calculate_days(birthday)
    return get_current_stage(days)

def write_milestone_log(birthday: date, stage_name: str, stage_days: int):
    """写入里程碑日志"""
    today = date.today()
    memory_dir = Path.home() / ".openclaw" / "workspace" / "memory"
    memory_dir.mkdir(parents=True, exist_ok=True)
    
    log_file = memory_dir / f"{today.isoformat()}.md"
    
    entry = f"""
## Agent 成长里程碑
- **{today.isoformat()} (第 {stage_days} 天)**: 进入 {stage_name} 阶段

"""
    
    # 如果文件存在，追加内容
    if log_file.exists():
        with open(log_file, "r", encoding="utf-8") as f:
            content = f.read()
        # 检查是否已经记录过这个里程碑
        if f"第 {stage_days} 天" in content:
            print(f"里程碑已记录: 第 {stage_days} 天 ({stage_name})")
            return
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(entry)
    else:
        with open(log_file, "w", encoding="utf-8") as f:
            f.write(f"# {today.isoformat()}\n")
            f.write(entry)
    
    print(f"✅ 已记录里程碑到: {log_file}")

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    arg = sys.argv[1]
    
    try:
        birthday = datetime.strptime(arg, "%Y-%m-%d").date()
    except ValueError:
        print(f"错误: 日期格式不正确，请使用 YYYY-MM-DD")
        sys.exit(1)
    
    today = date.today()
    days = calculate_days(birthday, today)
    
    stage_name, meaning, stage_days = get_current_stage(days)
    
    if stage_name:
        print(f"🎉 今天到达里程碑!")
        print(f"   阶段: {stage_name}")
        print(f"   天数: 第 {stage_days} 天")
        print(f"   含义: {meaning}")
        
        if "--check" not in sys.argv:
            write_milestone_log(birthday, stage_name, stage_days)
    else:
        print(f"今天不是里程碑日 (第 {days} 天)")
        # 显示下一个里程碑
        for sd, sn, sm in STAGES_100:
            if sd > days:
                print(f"下一个里程碑: {sn} (还有 {sd - days} 天)")
                break

if __name__ == "__main__":
    main()

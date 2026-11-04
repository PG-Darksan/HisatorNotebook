#!/usr/bin/env python3
"""訳の下書き (_i18n/work/<lang>-*.json、 {"番号": "訳"}) を _i18n/<lang>.json (日本語 → 訳) にまとめる

  python _i18n/merge.py <lang>          全部そろっていれば書く。 欠け・崩れは一覧を出して止まる
  python _i18n/merge.py <lang> --show N-M  source.json の N〜M 番を番号つきで表示する

番号は _i18n/source.json に並んでいる順 (0 から)。 既に <lang>.json にある訳は下書きが無くても使う
(日本語ページを直して増えた分だけ訳せば済む)。
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PH = re.compile(r'</?t\d+/?>')
JP = re.compile(r'[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]')
KANA = re.compile(r'[぀-ヿｦ-ﾟ]')
KEEP = {'日本語', '中文', '粵語', '吳語'}  # build.py の KEEP と同じ
ATTR_CTX = re.compile(r' \[(alt|title|aria-label|placeholder|value|content)\] ')


def main(argv):
    sys.stdout.reconfigure(encoding='utf-8')
    lang = argv[0]
    src = json.loads((HERE / 'source.json').read_text(encoding='utf-8'))
    keys = list(src)
    if '--show' in argv:
        a, b = map(int, argv[argv.index('--show') + 1].split('-'))
        for i in range(a, min(b, len(keys) - 1) + 1):
            print('### %d\n%s\n    (%s)' % (i, keys[i], src[keys[i]][:110]))
        return 0

    out_path = HERE / ('%s.json' % lang)
    done = json.loads(out_path.read_text(encoding='utf-8')) if out_path.exists() else {}
    drafts = {}
    for p in sorted((HERE / 'work').glob('%s-*.json' % lang)):
        for k, v in json.loads(p.read_text(encoding='utf-8')).items():
            drafts[int(k)] = v

    bad = KANA if lang == 'zh' else JP
    result, problems = {}, []
    for i, key in enumerate(keys):
        if key in KEEP:
            result[key] = key  # 各言語の自称。 訳さない
            continue
        val = drafts.get(i, done.get(key))
        if val is None:
            problems.append('%d: 訳が無い' % i)
            continue
        if not isinstance(val, str) or not val.strip():
            problems.append('%d: 空の訳' % i)
            continue
        if sorted(PH.findall(val)) != sorted(PH.findall(key)):
            problems.append('%d: <tN> の組が元と合わない: %s' % (i, val[:80]))
        if bad.search(PH.sub('', val)):
            problems.append('%d: 日本語が残っている: %s' % (i, val[:80]))
        if ATTR_CTX.search(src[key]) and ('"' in val or '<' in val):
            problems.append('%d: 属性の訳に " か < がある: %s' % (i, val[:80]))
        result[key] = val
    extra = sorted(set(drafts) - set(range(len(keys))))
    if extra:
        problems.append('番号が範囲外: %s' % extra[:10])
    if problems:
        print('\n'.join(problems))
        print('%s: 問題 %d 件 (書いていない)。 そろっている訳 %d / %d'
              % (lang, len(problems), len(result), len(keys)))
        return 1
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('%s: %d 件を %s に書いた' % (lang, len(result), out_path.name))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

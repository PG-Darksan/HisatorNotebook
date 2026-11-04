#!/usr/bin/env python3
"""HisatorNotebook サイトの多言語版を作る

日本語の *.html が正本。 _i18n/<lang>.json (日本語 → 訳の辞書) を引いて <lang>/<page> を
書き出し、 日本語ページの hreflang と言語メニュー、 sitemap.xml も揃える。
_i18n/ は先頭が _ なので GitHub Pages (Jekyll) では公開されない。

  python _i18n/build.py             全言語を生成 (訳の欠け・崩れがあれば何も書かずに止まる)
  python _i18n/build.py --extract   訳す文を _i18n/source.json に書き出す
  python _i18n/build.py --missing   言語ごとの欠けを _i18n/missing/<lang>.json に書き出す
  python _i18n/build.py --selftest  日本語を素通しで組み直し、 元と同じになるか確かめる

訳の単位は段落・見出し・リンクなどの塊の中身。 中のタグは <t0>…</t0> / <t1/> に置き換えて
鍵にし、 生成時に日本語ページのタグ (href など) を戻す。 日本語を含まない部分 (版番号や
ダウンロード URL) は鍵にならないので、 hp_dl.py でボタンを書き換えても訳し直しは要らない
(build.py を流し直すだけ)。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HERE = ROOT / '_i18n'
BASE = 'https://hisator-notebook.com/'


class Lang:
    def __init__(self, dir, html, hreflang, locale, name, code, badge):
        self.dir, self.html, self.hreflang, self.locale = dir, html, hreflang, locale
        self.name, self.code, self.badge = name, code, badge


LANGS = [
    Lang('ja', 'ja', 'ja', 'ja_JP', '日本語', 'JA', 'ja'),
    Lang('en', 'en', 'en', 'en_US', 'English', 'EN', 'en-us'),
    Lang('zh', 'zh-Hans', 'zh-Hans', 'zh_CN', '简体中文', 'ZH', 'zh-cn'),
    Lang('ko', 'ko', 'ko', 'ko_KR', '한국어', 'KO', 'ko'),
    Lang('es', 'es', 'es', 'es_ES', 'Español', 'ES', 'es'),
    Lang('fr', 'fr', 'fr', 'fr_FR', 'Français', 'FR', 'fr'),
    Lang('de', 'de', 'de', 'de_DE', 'Deutsch', 'DE', 'de'),
    Lang('pt', 'pt-BR', 'pt', 'pt_BR', 'Português', 'PT', 'pt-br'),
    Lang('ru', 'ru', 'ru', 'ru_RU', 'Русский', 'RU', 'ru'),
]
JA = LANGS[0]
X_DEFAULT = LANGS[1]  # どの言語にも当たらない人には英語を出す

# 日本語の書体 (Google Fonts の URL の一部)。 簡体中文と韓国語は字形が混ざる / 足りないので
# その言語の Noto に差し替える (styles.css の --font-serif / --font-sans が :lang で受ける)
JA_FONTS = 'family=Shippori+Mincho+B1:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@300;400;500;700'
FONTS = {
    'zh': 'family=Noto+Serif+SC:wght@400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700',
    'ko': 'family=Noto+Serif+KR:wght@400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;700',
}

# 訳すページ。 tokutei.html (特定商取引法) は日本の法律の表記なので日本語だけ。
# extensions-privacy.html (ブラウザー拡張) は元から日英 2 か国語の 1 枚なので触らない
PAGES = ['index.html', 'features-windows.html', 'features-android.html', 'ai.html',
         'video.html', 'platform.html', 'pricing.html', 'contact.html', 'privacy.html',
         'terms.html']
LEGAL = {'privacy.html', 'terms.html'}
SITEMAP_PAGES = ['index.html', 'features-windows.html', 'features-android.html',
                 'pricing.html', 'ai.html', 'video.html', 'platform.html', 'contact.html',
                 'privacy.html', 'terms.html', 'tokutei.html']

# 規約類の訳の頭に置く断り書き ({ja} = 日本語の原文への相対リンク)
NOTICE = {
    'en': 'This page is a translation provided for convenience. If there is any difference in meaning, the <a href="{ja}" hreflang="ja">Japanese original</a> prevails.',
    'zh': '本页为方便阅读而提供的译文。如有歧义，以<a href="{ja}" hreflang="ja">日文原文</a>为准。',
    'ko': '이 페이지는 편의를 위해 제공되는 번역본입니다. 내용에 차이가 있을 경우 <a href="{ja}" hreflang="ja">일본어 원문</a>이 우선합니다.',
    'es': 'Esta página es una traducción ofrecida por comodidad. En caso de discrepancia, prevalece el <a href="{ja}" hreflang="ja">original en japonés</a>.',
    'fr': 'Cette page est une traduction fournie à titre indicatif. En cas de divergence, l’<a href="{ja}" hreflang="ja">original japonais</a> fait foi.',
    'de': 'Diese Seite ist eine Übersetzung zur besseren Verständlichkeit. Bei Abweichungen gilt das <a href="{ja}" hreflang="ja">japanische Original</a>.',
    'pt': 'Esta página é uma tradução fornecida por conveniência. Em caso de divergência, prevalece o <a href="{ja}" hreflang="ja">original em japonês</a>.',
    'ru': 'Эта страница — перевод, предоставленный для удобства. При расхождениях приоритет имеет <a href="{ja}" hreflang="ja">оригинал на японском языке</a>.',
}

# 訳さずに元のまま出す塊 (platform.html の 30 言語の一覧は各言語の自称で並べてある)
KEEP = {'日本語', '中文', '粵語', '吳語'}

JP = re.compile(r'[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]')
KANA = re.compile(r'[぀-ヿｦ-ﾟ]')
TOKEN = re.compile(r'<!--.*?-->|<(script|style|svg|textarea|pre)\b[^>]*>.*?</\1\s*>|<[^>]+>|[^<]+',
                   re.S | re.I)
TAGNAME = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9-]*)')
ATTR = re.compile(r'(\s)([a-zA-Z_:][-a-zA-Z0-9_:.]*)="([^"]*)"')
PH = re.compile(r'</?t\d+/?>')
MENU = re.compile(r'(<div class="lang-menu" role="menu">)(.*?)(</div>)', re.S)
INLINE = {'a', 'b', 'strong', 'em', 'i', 'span', 'br', 'code', 'small', 'sup', 'sub', 'kbd',
          'mark', 'u', 's', 'abbr', 'time', 'wbr', 'img', 'q', 'cite', 'var', 'del', 'ins',
          'data', 'svg'}
VOID = {'br', 'img', 'wbr', 'input', 'meta', 'link', 'source', 'hr', 'area', 'base', 'col',
        'embed', 'track', 'param'}
RAW = {'script', 'style', 'svg', 'textarea', 'pre'}
URL_ATTRS = {'href', 'src', 'poster', 'action', 'data-src'}
TEXT_ATTRS = {'alt', 'title', 'aria-label', 'placeholder', 'value', 'content'}


def page_url(lang, page):
    return BASE + ('' if lang is JA else lang.dir + '/') + ('' if page == 'index.html' else page)


def rel_href(frm, to, page):
    """frm 言語のページから to 言語の page への相対リンク"""
    return ('' if frm is JA else '../') + ('' if to is JA else to.dir + '/') + page


def kind(tok):
    if tok.startswith('<!--'):
        return 'comment', ''
    m = TAGNAME.match(tok) if tok.startswith('<') else None
    if not m:
        return 'text', ''
    name = m.group(2).lower()
    if m.group(1):
        return 'close', name
    if name in RAW and re.search(r'</' + name + r'\s*>\s*$', tok, re.I):
        return 'raw', name
    if name in VOID or tok.endswith('/>'):
        return 'void', name
    return 'open', name


def is_el(c):
    return isinstance(c, dict)


def has_jp(kids):
    return any(has_jp(c['kids']) if is_el(c) else (c[0] == 'text' and JP.search(c[1]))
               for c in kids)


def has_text(kids):
    return any(has_text(c['kids']) if is_el(c) else (c[0] == 'text' and c[1].strip())
               for c in kids)


def tree(run):
    """インラインのタグと文字の並びを木にする。 閉じていない要素は開きタグだけの塊に戻す"""
    root = {'name': None, 'open': None, 'close': None, 'kids': []}
    stack = [root]
    for k, name, tok in run:
        if k == 'open':
            node = {'name': name, 'open': tok, 'close': None, 'kids': []}
            stack[-1]['kids'].append(node)
            stack.append(node)
        elif k == 'close' and len(stack) > 1 and stack[-1]['name'] == name:
            stack[-1]['close'] = tok
            stack.pop()
        elif k == 'text':
            stack[-1]['kids'].append(('text', tok))
        else:
            stack[-1]['kids'].append(('atom', tok))

    def fix(node):
        kids = []
        for c in node['kids']:
            if is_el(c):
                fix(c)
                if c['close'] is None:
                    kids.append(('atom', c['open']))
                    kids.extend(c['kids'])
                    continue
            kids.append(c)
        node['kids'] = kids
    fix(root)
    return root['kids']


class Table:
    """訳の辞書を引く。 collect を渡すと引かずに鍵を集める (--extract)"""

    def __init__(self, table=None, collect=None):
        self.table, self.collect = table or {}, collect
        self.missing, self.errors, self.used = {}, [], set()

    def __call__(self, key, ctx):
        if self.collect is not None:
            self.collect.setdefault(key, ctx)
            return key
        if key in KEEP:
            return key
        self.used.add(key)
        val = self.table.get(key)
        if val is None:
            self.missing.setdefault(key, ctx)
            return key
        if sorted(PH.findall(val)) != sorted(PH.findall(key)):
            self.errors.append('タグの置き換えが合わない: %r -> %r' % (key, val))
            return key
        return val


class Renderer:
    def __init__(self, page, lang, tr):
        """lang=None なら URL を書き換えない (抽出・自己検査)"""
        self.page, self.lang, self.tr = page, lang, tr
        self.ctx = page

    def relurl(self, v):
        if not v or v.startswith(('http:', 'https:', '//', '/', '#', 'mailto:', 'tel:',
                                  'data:', 'javascript:')):
            return v
        if re.split(r'[?#]', v, 1)[0] in PAGES:
            return v
        return '../' + v

    def tag(self, tok):
        if self.tr is None and self.lang is None:
            return tok

        def rep(m):
            sp, attr, val = m.groups()
            a = attr.lower()
            if self.lang is not None and a in URL_ATTRS:
                if a == 'src' and 'images/store/ms-store-ja.svg' in val:
                    val = val.replace('ms-store-ja.svg', 'ms-store-%s.svg' % self.lang.badge)
                val = self.relurl(val)
            elif self.lang is not None and a == 'srcset':
                val = ', '.join(' '.join([self.relurl(p.split()[0])] + p.split()[1:])
                                for p in val.split(',') if p.strip())
            elif a == 'value' and 'name="_subject"' in tok:
                if self.lang is not None:
                    val = '%s (%s)' % (val, self.lang.dir)
            elif a in TEXT_ATTRS and JP.search(val) and self.tr is not None:
                val = self.tr(val, '%s [%s] %s' % (self.page, a, tok[:90])).replace('"', '&quot;')
            return '%s%s="%s"' % (sp, attr, val)
        return ATTR.sub(rep, tok)

    def verb(self, kids):
        s = []
        for c in kids:
            if is_el(c):
                s.append(self.tag(c['open']) + self.verb(c['kids']) + c['close'])
            elif c[0] == 'atom':
                s.append(self.tag(c[1]))
            else:
                s.append(c[1])
        return ''.join(s)

    def walk(self, kids):
        if not has_jp(kids):
            return self.verb(kids)
        if any(not is_el(c) and c[0] == 'text' and c[1].strip() for c in kids):
            return self.unit(kids)
        return ''.join(self.tag(c['open']) + self.walk(c['kids']) + c['close'] if is_el(c)
                       else self.verb([c]) for c in kids)

    def unit(self, kids):
        def edge(c):
            return (not has_text(c['kids'])) if is_el(c) else (c[0] == 'atom' or not c[1].strip())
        i, j = 0, len(kids)
        while i < j and edge(kids[i]):
            i += 1
        while j > i and edge(kids[j - 1]):
            j -= 1
        parts = {}

        def ser(ks):
            s = []
            for c in ks:
                n = len(parts)
                if is_el(c):
                    parts[n] = (c['open'], c['close'])
                    s.append('<t%d>%s</t%d>' % (n, ser(c['kids']), n))
                elif c[0] == 'atom':
                    parts[n] = (c[1], None)
                    s.append('<t%d/>' % n)
                else:
                    s.append(c[1])
            return ''.join(s)
        s = ser(kids[i:j])
        lead, trail = s[:len(s) - len(s.lstrip())], s[len(s.rstrip()):]
        key = re.sub(r'\s+', ' ', s.strip())
        val = self.tr(key, self.ctx) if self.tr is not None else key

        def back(m):
            t = m.group(0)
            o, c = parts[int(re.search(r'\d+', t).group())]
            return c if t.startswith('</') else self.tag(o)
        return self.verb(kids[:i]) + lead + PH.sub(back, val) + trail + self.verb(kids[j:])

    def ld(self, o, org=False):
        if isinstance(o, dict):
            org = o.get('@type') == 'Organization'
            return {k: (self.lang.hreflang if k == 'inLanguage' and self.lang is not None
                        else self.ld(v, org)) for k, v in o.items()}
        if isinstance(o, list):
            return [self.ld(v, org) for v in o]
        if isinstance(o, str):
            if JP.search(o) and self.tr is not None:
                return self.tr(o, '%s [json-ld]' % self.page)
            if self.lang is not None and not org and o.startswith(BASE):
                path = o[len(BASE):]
                if path in PAGES or path == '':
                    return page_url(self.lang, path or 'index.html')
        return o

    def raw(self, tok, name):
        cut = tok.index('>') + 1
        head, rest = tok[:cut], tok[cut:]
        if name == 'script' and 'application/ld+json' in head and self.tr is not None:
            end = rest.lower().rindex('</script')
            data = self.ld(json.loads(rest[:end]))
            if self.lang is None:
                return tok
            return head + json.dumps(data, ensure_ascii=False) + rest[end:]
        return self.tag(head) + rest

    def render(self, src):
        out, run = [], []

        def flush():
            if run:
                out.append(self.walk(tree(run)))
                run.clear()
        for m in TOKEN.finditer(src):
            tok = m.group(0)
            k, name = kind(tok)
            if k == 'text' or (name in INLINE and k in ('open', 'close', 'void', 'raw')):
                run.append((k, name, tok))
                continue
            flush()
            if k == 'raw':
                out.append(self.raw(tok, name))
            elif k in ('open', 'void'):
                self.ctx = '%s %s' % (self.page, tok[:90])
                out.append(self.tag(tok))
            else:
                out.append(tok)
        flush()
        return ''.join(out)


def nl_of(text):
    return '\r\n' if '\r\n' in text else '\n'


def read(path):
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and read(path) == text:
        return False
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    return True


def menu_html(page, cur, nl):
    rows = []
    for L in LANGS:
        cls = ' class="current"' if L is cur else ''
        href = page if L is cur else rel_href(cur, L, page)
        rows.append('%s        <a href="%s"%s hreflang="%s" lang="%s"><span>%s</span>'
                    '<span class="lang-code">%s</span></a>'
                    % (nl, href, cls, L.hreflang, L.html, L.name, L.code))
    return ''.join(rows) + nl + '      '


def with_menu(text, page, cur, nl):
    text, n = MENU.subn(lambda m: m.group(1) + menu_html(page, cur, nl) + m.group(3), text, 1)
    text, k = re.subn(r'(<button class="lang-toggle"[^>]*>\s*<span>)[^<]*(</span>)',
                      lambda m: m.group(1) + cur.code + m.group(2), text, 1)
    if not (n and k):
        raise SystemExit('%s: 言語メニューが見つからない' % page)
    return text


def with_alternates(text, page, nl):
    rows = ['<!-- i18n:alternates (_i18n/build.py が書く) -->']
    rows += ['<link rel="alternate" hreflang="%s" href="%s">' % (L.hreflang, page_url(L, page))
             for L in LANGS]
    rows.append('<link rel="alternate" hreflang="x-default" href="%s">'
                % page_url(X_DEFAULT, page))
    rows.append('<!-- /i18n:alternates -->')
    block = (nl + '  ').join(rows)
    if '<!-- i18n:alternates' in text:
        return re.sub(r'<!-- i18n:alternates.*?<!-- /i18n:alternates -->', lambda m: block,
                      text, 1, re.S)
    text, n = re.subn(r'(<link rel="canonical" href="[^"]*">)',
                      lambda m: m.group(1) + nl + '  ' + block, text, 1)
    if not n:
        raise SystemExit('%s: canonical が無い' % page)
    return text


def ja_source(page):
    """日本語ページに hreflang と言語メニューを入れた物 (これを訳の元にもする)"""
    text = read(ROOT / page)
    nl = nl_of(text)
    return with_menu(with_alternates(text, page, nl), page, JA, nl)


HOLE = '<!--i18n:menu-->'


def holed(page):
    """訳の元。 言語メニューの中身 (各言語の自称) は訳さないので穴にしておく"""
    src = ja_source(page)
    menu = MENU.search(src)
    return src if not menu else src[:menu.start(2)] + HOLE + src[menu.end(2):]


def localize(page, lang, tr):
    body = holed(page)
    nl = nl_of(body)
    out = Renderer(page, lang, tr).render(body)
    out = out.replace(HOLE, menu_html(page, lang, nl))
    out = re.sub(r'<button class="lang-toggle"([^>]*>\s*<span>)[^<]*',
                 lambda m: '<button class="lang-toggle"' + m.group(1) + lang.code, out, 1)
    subs = [
        (r'<html lang="ja"', '<html lang="%s"' % lang.html),
        (r'(<link rel="canonical" href=")[^"]*', r'\g<1>' + page_url(lang, page)),
        (r'(<meta property="og:url" content=")[^"]*', r'\g<1>' + page_url(lang, page)),
        (r'(<meta property="og:locale" content=")[^"]*', r'\g<1>' + lang.locale),
    ]
    for pat, rep in subs:
        out, n = re.subn(pat, rep, out, 1)
        if not n and 'og:' not in pat:
            raise SystemExit('%s: %s が無い' % (page, pat))
    if lang.dir in FONTS:
        if JA_FONTS not in out:
            raise SystemExit('%s: 書体の URL が見つからない' % page)
        out = out.replace(JA_FONTS, FONTS[lang.dir])
    if page in LEGAL:
        note = ('<div class="container i18n-notice" role="note"><p>%s</p></div>'
                % NOTICE[lang.dir].format(ja='../' + page))
        out, n = re.subn(r'(<main\b[^>]*>)', lambda m: m.group(1) + nl + note, out, 1)
        if not n:
            raise SystemExit('%s: main が無い' % page)
    return out


def sitemap():
    old = read(ROOT / 'sitemap.xml')
    nl = nl_of(old)
    meta = {}
    for m in re.finditer(r'<url>(.*?)</url>', old, re.S):
        loc = re.search(r'<loc>(.*?)</loc>', m.group(1)).group(1)
        meta[loc] = {t: v.group(1) for t in ('lastmod', 'changefreq', 'priority')
                     for v in [re.search('<%s>(.*?)</%s>' % (t, t), m.group(1))] if v}
    rows = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<!-- _i18n/build.py が生成。 lastmod などは日本語の URL の行を直せば、 次の生成で他の言語にも写る -->',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for page in SITEMAP_PAGES:
        jm = meta.get(page_url(JA, page), {})
        for L in (LANGS if page in PAGES else [JA]):
            rows.append('  <url>')
            rows.append('    <loc>%s</loc>' % page_url(L, page))
            rows += ['    <%s>%s</%s>' % (t, jm[t], t)
                     for t in ('lastmod', 'changefreq', 'priority') if t in jm]
            if page in PAGES:
                rows += ['    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>'
                         % (T.hreflang, page_url(T, page)) for T in LANGS]
                rows.append('    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>'
                            % page_url(X_DEFAULT, page))
            rows.append('  </url>')
    rows.append('</urlset>')
    return nl.join(rows) + nl


def load(lang):
    p = HERE / ('%s.json' % lang.dir)
    return json.loads(read(p)) if p.exists() else {}


def check_script(lang, table, used):
    """訳に日本語が残っていないか (中国語の漢字は除く)"""
    bad = KANA if lang.dir == 'zh' else JP
    return ['%s: 日本語が残っている: %r' % (lang.dir, table[k])
            for k in sorted(used) if k in table and bad.search(PH.sub('', table[k]))]


def main(argv):
    sys.stdout.reconfigure(encoding='utf-8')
    if '--selftest' in argv:
        ok = True
        for page in PAGES:
            src = ja_source(page)
            out = Renderer(page, None, None).render(src)
            same = re.sub(r'\s+', ' ', out) == re.sub(r'\s+', ' ', src)
            print('%-24s %s' % (page, 'ok' if same else 'DIFF'))
            ok &= same
        return 0 if ok else 1

    if '--extract' in argv:
        found = {}
        for page in PAGES:
            Renderer(page, None, Table(collect=found)).render(holed(page))
        write(HERE / 'source.json', json.dumps(found, ensure_ascii=False, indent=1) + '\n')
        print('%d 件 / %d 文字 → _i18n/source.json' % (len(found), sum(map(len, found))))
        return 0

    results, problems = {}, []
    for lang in LANGS[1:]:
        table = load(lang)
        tr = Table(table)
        results[lang.dir] = {page: localize(page, lang, tr) for page in PAGES}
        problems += ['%s: %s' % (lang.dir, e) for e in tr.errors]
        problems += check_script(lang, table, tr.used)
        if '--missing' in argv:
            (HERE / 'missing').mkdir(exist_ok=True)
            write(HERE / 'missing' / ('%s.json' % lang.dir),
                  json.dumps(tr.missing, ensure_ascii=False, indent=1) + '\n')
        stale = len(set(table) - tr.used)
        print('%s: 訳 %d 件、 欠け %d 件、 使われていない訳 %d 件'
              % (lang.dir, len(tr.used) - len(tr.missing), len(tr.missing), stale))
        if tr.missing:
            problems.append('%s: 訳が %d 件欠けている (--missing で書き出せる)'
                            % (lang.dir, len(tr.missing)))
    if '--missing' in argv:
        return 0
    if problems:
        print('\n'.join(problems[:40]))
        print('問題 %d 件。 何も書いていない' % len(problems))
        return 1

    changed = []
    for page in PAGES:
        if write(ROOT / page, ja_source(page)):
            changed.append(page)
    for d, pages in results.items():
        for page, text in pages.items():
            if write(ROOT / d / page, text):
                changed.append('%s/%s' % (d, page))
    if write(ROOT / 'sitemap.xml', sitemap()):
        changed.append('sitemap.xml')
    print('書いた: %d 件' % len(changed))
    for c in changed:
        print('  ' + c)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

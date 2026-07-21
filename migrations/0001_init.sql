-- D1 schema and initial navigation data.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'book',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_category_sort ON bookmarks(category_id, sort_order, id);

INSERT INTO categories (name, icon, sort_order) VALUES ('工作', 'briefcase', 0);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'x', 'https://twitter.com/?lang=zh', 0);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'chatgpt', 'https://chatgpt.com/', 1);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'deepseek', 'https://www.deepseek.com/', 2);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'grok', 'https://grok.com/', 3);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'volcengine', 'https://ai.volcengine.com/', 4);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'jianying', 'https://jimeng.jianying.com/', 5);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'aliyun', 'http://www.aliyun.com/', 6);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'github', 'https://github.com/', 7);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'gitee', 'https://gitee.com/', 8);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'flova.ai', 'https://www.flova.ai/', 9);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'obsidian.md', 'https://obsidian.md/', 10);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'kiro.dev', 'https://kiro.dev', 11);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'youtube', 'https://www.youtube.com/', 12);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'weixin.qq', 'https://mp.weixin.qq.com/', 13);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'dify.ai', 'https://dify.ai/', 14);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'aws.amazon', 'https://aws.amazon.com/cn/', 15);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'worldrouter.ai', 'https://www.worldrouter.ai/', 16);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'feishu.cn', 'https://open.feishu.cn/?lang=zh-CN', 17);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'ipaddress.my', 'https://ipaddress.my/', 18);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='工作'), 'ip.skk', 'https://ip.skk.moe/', 19);

INSERT INTO categories (name, icon, sort_order) VALUES ('学习', 'book', 1);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), '52pojie', 'https://www.52pojie.cn/portal.php', 0);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), '考神资源网', 'https://www.nishioka.com.cn/', 1);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), 'scratchor', 'https://tiku.scratchor.com/', 2);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), 'appstorrent.ru', 'https://appstorrent.ru/', 3);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), 'macwk.cn', 'https://macwk.cn/', 4);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), 'cnblogs', 'http://www.cnblogs.com/', 5);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), 'csdn.net', 'https://www.csdn.net/', 6);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), '51cto', 'http://edu.51cto.com/', 7);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), 'msdn.cn', 'https://next.itellyou.cn/Original/', 8);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='学习'), 'yage.ai', 'https://yage.ai/share/', 9);

INSERT INTO categories (name, icon, sort_order) VALUES ('购物', 'cart', 2);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), '5sim.net', 'https://5sim.net/zh', 0);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'smspool.net', 'https://www.smspool.net/', 1);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'shadowsocks.nz', 'https://portal.shadowsocks.nz/', 2);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'pockyt.io', 'https://shop.pockyt.io/pc/home', 3);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'binance', 'https://www.binance.com/zh-CN', 4);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'jd', 'http://www.jd.com/', 5);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'apple.cn', 'http://www.apple.com.cn/', 6);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'taobao', 'http://www.taobao.com/', 7);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'tmall', 'http://www.tmall.com/', 8);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'ctrip', 'https://www.ctrip.com/', 9);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), '12306.cn', 'https://www.12306.cn/index/', 10);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'paypal', 'http://www.paypal.com/', 11);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'ikea.cn', 'https://www.ikea.cn/cn/zh/', 12);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'chiphell', 'http://www.chiphell.com/', 13);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'qq-ex', 'http://www.qq-ex.com/', 14);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='购物'), 'amazon', 'https://www.amazon.com/', 15);

INSERT INTO categories (name, icon, sort_order) VALUES ('娱乐', 'smile', 3);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'bilibili', 'https://www.bilibili.com/', 0);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'douyin', 'https://www.douyin.com/', 1);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'weibo', 'http://weibo.com/', 2);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'nga.cn', 'https://bbs.nga.cn/', 3);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'qzone', 'https://qzone.qq.com/', 4);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'windy', 'https://www.windy.com/', 5);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'maprunner.info', 'https://www.maprunner.info/', 6);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'flightsim.to', 'https://flightsim.to/', 7);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'simbrief', 'https://www.simbrief.com/home/', 8);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'navigraph', 'https://navigraph.com/', 9);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'simmarket', 'https://secure.simmarket.com/default-zh.html', 10);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'fsprojects.eu', 'https://www.fsprojects.eu/', 11);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'wingflexsim', 'https://wingflexsim.com/', 12);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'cat3design', 'https://cat3design.com/', 13);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'throttletek', 'https://throttletek.com/', 14);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'minicockpit', 'https://www.minicockpit.com/', 15);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'fenixsim', 'https://fenixsim.com/', 16);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'vatsim.net', 'https://my.vatsim.net/home', 17);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'adsbexchange', 'https://globe.adsbexchange.com/', 18);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'flightradar24', 'https://www.flightradar24.com/', 19);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'fsdreamteam', 'http://www.fsdreamteam.com/', 20);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'rexsimulations', 'https://www.rexsimulations.com', 21);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'inibuilds', 'https://store.inibuilds.com/', 22);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'quickmadesim', 'https://www.quickmadesim.com/', 23);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'justflight', 'https://www.justflight.com/', 24);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'x-plane', 'https://forums.x-plane.org/', 25);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'msfs.forums', 'https://forums.flightsimulator.com/', 26);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'jetphotos', 'https://www.jetphotos.com/', 27);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'airliners.net', 'http://www.airliners.net/', 28);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'sinofsx', 'http://bbs.sinofsx.com/index.php', 29);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'twitch.tv', 'https://www.twitch.tv/directory/category/world-of-warcraft', 30);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'wago.io', 'https://wago.io/', 31);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'wowhead', 'https://www.wowhead.com/wow/retail', 32);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'raider.io', 'https://raider.io/cn/', 33);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'steampowered', 'http://store.steampowered.com', 34);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'g-portal', 'https://www.g-portal.com/', 35);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'playstation', 'https://asia.playstation.com/cht-hk/psn/playstation-plus/', 36);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'worldoftrucks', 'https://www.worldoftrucks.com/en/', 37);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'prismray.io', 'https://prismray.io/zh-CN', 38);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='娱乐'), 'rainymood', 'http://rainymood.com/', 39);

INSERT INTO categories (name, icon, sort_order) VALUES ('理财', 'money', 4);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='理财'), '北京摇号', 'https://xkczb.jtw.beijing.gov.cn/', 0);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='理财'), '北京公积金', 'https://gjj.beijing.gov.cn/', 1);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='理财'), '工商银行', 'http://www.icbc.com.cn/', 2);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='理财'), '中国建设银行', 'http://www.ccb.com/', 3);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='理财'), '建行信用卡', 'http://creditcard.ccb.com/', 4);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='理财'), '交通银行', 'http://www.95559.com.cn/', 5);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='理财'), '交通银行信用卡中心', 'http://creditcard.bankcomm.com/', 6);

INSERT INTO categories (name, icon, sort_order) VALUES ('路由', 'router', 5);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), 'ifdian.net', 'https://ifdian.net/', 0);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), 'koolcenter', 'https://www.koolcenter.com/', 1);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), 'speedtest.net', 'http://www.speedtest.net/', 2);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), 'RT-AX89X', 'https://touchandgo0919.ddnsto.com/Main_Login.asp', 3);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), 'R8000', 'https://vinsanity0919.ddnsto.com/Main_Login.asp', 4);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), 'R7000', 'https://zhaotao0919.ddnsto.com/Main_Login.asp', 5);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), 'RT-AX86U', 'https://xingyue0930.ddnsto.com/Main_Login.asp', 6);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), '公司路由', 'https://beagle0919.ddnsto.com/Main_Login.asp', 7);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), '内网路由', 'http://192.168.2.1/', 8);
INSERT INTO bookmarks (category_id, title, url, sort_order) VALUES ((SELECT id FROM categories WHERE name='路由'), '北京宽带网', 'http://www.bbn.com.cn/', 9);


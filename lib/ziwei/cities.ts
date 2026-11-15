export interface CityInfo {
  name: string;
  longitude: number; // degrees East
  lon?: number;
  lat?: number;
  tz?: number;
  utcOffsetMinutes?: number;
  country?: string;
}

export interface CityGeoRecord {
  name: string;
  lon: number;
  lat: number;
  tz: number;
  utcOffsetMinutes: number;
  country: string;
}

export interface ProvinceInfo {
  name: string;
  cities: CityInfo[];
}

// ★ 2026-10-07 用户反馈「出生地点还不够全」→ 补全全国区县（直辖市以外 2724 个，挂在各地级市下）。
//   区县不放进本表：本表经 BirthForm → LocationPicker 在 /chart、/heming 首屏静态依赖图上，
//   区县表与拼音表在 lib/ziwei/counties.generated.ts、lib/i18n/county-pinyin.generated.ts，
//   打开地点选择框时才动态加载（lib/ziwei/county-data.ts）。区县选中后城市字段存成「地级市·区县」，
//   见 lib/ziwei/county-label.ts。省直辖县级单位（仙桃、海南各市县、新疆兵团各市）仍是本表的市一级。
export const PROVINCES: ProvinceInfo[] = [
  // ─── 直辖市 ───────────────────────────────────────────
  {
    name: '北京市',
    cities: [
      // ★ 2026-08-23 用户反馈「直辖市内部也有分区，希望加上更准一些」→ 补全 16 区。
      //   保留「北京」市级条目在首位：老用户历史命盘存的是它，删掉会对不上。
      //   全市经度跨度 115.98–117.12（延庆↔平谷），约 1.14°，真太阳时最大差约 4.6 分钟——
      //   出生时刻落在时辰交界 ±5 分钟内时，选市中心与选边缘区会得到不同时辰，整盘皆变。
      { name: '北京', longitude: 116.4 },
      { name: '东城', longitude: 116.42 },
      { name: '西城', longitude: 116.37 },
      { name: '朝阳', longitude: 116.49 },
      { name: '丰台', longitude: 116.29 },
      { name: '石景山', longitude: 116.22 },
      { name: '海淀', longitude: 116.30 },
      { name: '门头沟', longitude: 116.10 },
      { name: '房山', longitude: 116.14 },
      { name: '通州', longitude: 116.66 },
      { name: '顺义', longitude: 116.65 },
      { name: '昌平', longitude: 116.24 },
      { name: '大兴', longitude: 116.34 },
      { name: '怀柔', longitude: 116.64 },
      { name: '平谷', longitude: 117.12 },
      { name: '密云', longitude: 116.84 },
      { name: '延庆', longitude: 115.98 },
    ],
  },
  {
    name: '天津市',
    cities: [
      // 跨度 116.97–117.83（静海↔宁河），约 0.86°，真太阳时最大差约 3.4 分钟
      { name: '天津', longitude: 117.2 },
      { name: '和平', longitude: 117.21 },
      { name: '河东', longitude: 117.24 },
      { name: '河西', longitude: 117.22 },
      { name: '南开', longitude: 117.15 },
      { name: '河北', longitude: 117.20 },
      { name: '红桥', longitude: 117.15 },
      { name: '东丽', longitude: 117.31 },
      { name: '西青', longitude: 117.01 },
      { name: '津南', longitude: 117.36 },
      { name: '北辰', longitude: 117.13 },
      { name: '武清', longitude: 117.04 },
      { name: '宝坻', longitude: 117.31 },
      { name: '滨海新区', longitude: 117.70 },
      { name: '宁河', longitude: 117.83 },
      { name: '静海', longitude: 116.97 },
      { name: '蓟州', longitude: 117.41 },
    ],
  },
  {
    name: '上海市',
    cities: [
      // 跨度 121.12–121.56（青浦↔浦东新区），约 0.44°，真太阳时最大差约 1.8 分钟
      { name: '上海', longitude: 121.5 },
      { name: '黄浦', longitude: 121.49 },
      { name: '徐汇', longitude: 121.44 },
      { name: '长宁', longitude: 121.42 },
      { name: '静安', longitude: 121.45 },
      { name: '普陀', longitude: 121.40 },
      { name: '虹口', longitude: 121.51 },
      { name: '杨浦', longitude: 121.53 },
      { name: '闵行', longitude: 121.38 },
      { name: '宝山', longitude: 121.49 },
      { name: '嘉定', longitude: 121.25 },
      { name: '浦东新区', longitude: 121.56 },
      { name: '金山', longitude: 121.34 },
      { name: '松江', longitude: 121.23 },
      { name: '青浦', longitude: 121.12 },
      { name: '奉贤', longitude: 121.47 },
      { name: '崇明', longitude: 121.40 },
    ],
  },
  {
    name: '重庆市',
    cities: [
      // 主城九区
      { name: '渝中', longitude: 106.6 },
      { name: '大渡口', longitude: 106.5 },
      { name: '江北', longitude: 106.6 },
      { name: '沙坪坝', longitude: 106.5 },
      { name: '九龙坡', longitude: 106.5 },
      { name: '南岸', longitude: 106.6 },
      { name: '北碚', longitude: 106.4 },
      { name: '渝北', longitude: 106.6 },
      { name: '巴南', longitude: 106.5 },
      // 远郊区
      { name: '万州', longitude: 108.4 },
      { name: '涪陵', longitude: 107.4 },
      { name: '黔江', longitude: 108.8 },
      { name: '长寿', longitude: 107.1 },
      { name: '江津', longitude: 106.3 },
      { name: '合川', longitude: 106.3 },
      { name: '永川', longitude: 105.9 },
      { name: '南川', longitude: 107.1 },
      { name: '綦江', longitude: 106.7 },
      { name: '大足', longitude: 105.7 },
      { name: '璧山', longitude: 106.2 },
      { name: '铜梁', longitude: 106.1 },
      { name: '潼南', longitude: 105.8 },
      { name: '荣昌', longitude: 105.6 },
      { name: '开州', longitude: 108.4 },
      { name: '梁平', longitude: 107.8 },
      { name: '武隆', longitude: 107.8 },
      // 县
      { name: '城口', longitude: 108.7 },
      { name: '丰都', longitude: 107.7 },
      { name: '垫江', longitude: 107.4 },
      { name: '忠县', longitude: 108.1 },
      { name: '云阳', longitude: 108.7 },
      { name: '奉节', longitude: 109.5 },
      { name: '巫山', longitude: 109.9 },
      { name: '巫溪', longitude: 109.6 },
      // 自治县
      { name: '石柱', longitude: 108.1 },
      { name: '秀山', longitude: 109.0 },
      { name: '酉阳', longitude: 108.8 },
      { name: '彭水', longitude: 108.2 },
    ],
  },

  // ─── 华北 ─────────────────────────────────────────────
  {
    name: '河北省',
    cities: [
      { name: '石家庄', longitude: 114.5 },
      { name: '保定', longitude: 115.5 },
      { name: '唐山', longitude: 118.2 },
      { name: '秦皇岛', longitude: 119.6 },
      { name: '廊坊', longitude: 116.7 },
      { name: '张家口', longitude: 114.9 },
      { name: '承德', longitude: 117.9 },
      { name: '沧州', longitude: 116.8 },
      { name: '邯郸', longitude: 114.5 },
      { name: '衡水', longitude: 115.7 },
      { name: '邢台', longitude: 114.5 },
    ],
  },
  {
    name: '山西省',
    cities: [
      { name: '太原', longitude: 112.6 },
      { name: '大同', longitude: 113.3 },
      { name: '长治', longitude: 113.1 },
      { name: '晋城', longitude: 112.9 },
      { name: '朔州', longitude: 112.4 },
      { name: '晋中', longitude: 112.8 },
      { name: '运城', longitude: 111.0 },
      { name: '忻州', longitude: 112.7 },
      { name: '临汾', longitude: 111.5 },
      { name: '吕梁', longitude: 111.1 },
      { name: '阳泉', longitude: 113.6 },
    ],
  },
  {
    name: '内蒙古自治区',
    cities: [
      { name: '呼和浩特', longitude: 111.7 },
      { name: '包头', longitude: 110.0 },
      { name: '鄂尔多斯', longitude: 109.8 },
      { name: '赤峰', longitude: 118.9 },
      { name: '通辽', longitude: 122.3 },
      { name: '呼伦贝尔', longitude: 119.7 },
      { name: '乌兰察布', longitude: 113.1 },
      { name: '巴彦淖尔', longitude: 107.4 },
      { name: '锡林郭勒', longitude: 116.1 },
      { name: '乌海', longitude: 106.8 },
      { name: '兴安盟', longitude: 122.1 },
      { name: '阿拉善盟', longitude: 105.7 },
    ],
  },

  // ─── 东北 ─────────────────────────────────────────────
  {
    name: '辽宁省',
    cities: [
      { name: '沈阳', longitude: 123.4 },
      { name: '大连', longitude: 121.6 },
      { name: '鞍山', longitude: 122.9 },
      { name: '抚顺', longitude: 123.9 },
      { name: '本溪', longitude: 123.8 },
      { name: '丹东', longitude: 124.4 },
      { name: '锦州', longitude: 121.1 },
      { name: '营口', longitude: 122.2 },
      { name: '阜新', longitude: 121.7 },
      { name: '辽阳', longitude: 123.2 },
      { name: '朝阳', longitude: 120.5 },
      { name: '盘锦', longitude: 122.1 },
      { name: '葫芦岛', longitude: 120.8 },
      { name: '铁岭', longitude: 123.8 },
    ],
  },
  {
    name: '吉林省',
    cities: [
      { name: '长春', longitude: 125.4 },
      { name: '吉林', longitude: 126.6 },
      { name: '四平', longitude: 124.4 },
      { name: '辽源', longitude: 125.1 },
      { name: '通化', longitude: 125.9 },
      { name: '白山', longitude: 126.4 },
      { name: '松原', longitude: 124.8 },
      { name: '白城', longitude: 122.8 },
      { name: '延边', longitude: 129.5 },
    ],
  },
  {
    name: '黑龙江省',
    cities: [
      { name: '哈尔滨', longitude: 126.5 },
      { name: '齐齐哈尔', longitude: 123.9 },
      { name: '牡丹江', longitude: 129.6 },
      { name: '佳木斯', longitude: 130.4 },
      { name: '大庆', longitude: 125.0 },
      { name: '绥化', longitude: 126.9 },
      { name: '鸡西', longitude: 130.9 },
      { name: '双鸭山', longitude: 131.2 },
      { name: '伊春', longitude: 128.9 },
      { name: '七台河', longitude: 130.8 },
      { name: '抚远（中国最东）', longitude: 134.3 },
      { name: '鹤岗', longitude: 130.3 },
      { name: '黑河', longitude: 127.5 },
      { name: '大兴安岭', longitude: 124.1 },
    ],
  },

  // ─── 华东 ─────────────────────────────────────────────
  {
    name: '江苏省',
    cities: [
      { name: '南京', longitude: 118.8 },
      { name: '苏州', longitude: 120.6 },
      { name: '无锡', longitude: 120.3 },
      { name: '常州', longitude: 119.9 },
      { name: '南通', longitude: 120.9 },
      { name: '扬州', longitude: 119.4 },
      { name: '徐州', longitude: 117.2 },
      { name: '连云港', longitude: 119.2 },
      { name: '淮安', longitude: 119.0 },
      { name: '盐城', longitude: 120.2 },
      { name: '镇江', longitude: 119.5 },
      { name: '泰州', longitude: 119.9 },
      { name: '宿迁', longitude: 118.3 },
    ],
  },
  {
    name: '浙江省',
    cities: [
      { name: '杭州', longitude: 120.1 },
      { name: '宁波', longitude: 121.6 },
      { name: '温州', longitude: 120.7 },
      { name: '嘉兴', longitude: 120.8 },
      { name: '湖州', longitude: 120.1 },
      { name: '绍兴', longitude: 120.6 },
      { name: '金华', longitude: 119.6 },
      { name: '衢州', longitude: 118.9 },
      { name: '舟山', longitude: 122.1 },
      { name: '台州', longitude: 121.4 },
      { name: '丽水', longitude: 119.9 },
    ],
  },
  {
    name: '安徽省',
    cities: [
      { name: '合肥', longitude: 117.3 },
      { name: '芜湖', longitude: 118.4 },
      { name: '蚌埠', longitude: 117.4 },
      { name: '淮南', longitude: 117.0 },
      { name: '马鞍山', longitude: 118.5 },
      { name: '淮北', longitude: 116.8 },
      { name: '铜陵', longitude: 117.8 },
      { name: '安庆', longitude: 117.1 },
      { name: '黄山', longitude: 118.3 },
      { name: '滁州', longitude: 118.3 },
      { name: '阜阳', longitude: 115.8 },
      { name: '宿州', longitude: 116.9 },
      { name: '六安', longitude: 116.5 },
      { name: '亳州', longitude: 115.8 },
      { name: '池州', longitude: 117.5 },
      { name: '宣城', longitude: 118.8 },
    ],
  },
  {
    name: '福建省',
    cities: [
      { name: '福州', longitude: 119.3 },
      { name: '厦门', longitude: 118.1 },
      { name: '莆田', longitude: 119.0 },
      { name: '三明', longitude: 117.6 },
      { name: '泉州', longitude: 118.7 },
      { name: '漳州', longitude: 117.6 },
      { name: '南平', longitude: 118.2 },
      { name: '龙岩', longitude: 117.0 },
      { name: '宁德', longitude: 119.5 },
    ],
  },
  {
    name: '江西省',
    cities: [
      { name: '南昌', longitude: 115.9 },
      { name: '景德镇', longitude: 117.2 },
      { name: '萍乡', longitude: 113.9 },
      { name: '九江', longitude: 116.0 },
      { name: '新余', longitude: 114.9 },
      { name: '鹰潭', longitude: 117.1 },
      { name: '赣州', longitude: 114.9 },
      { name: '吉安', longitude: 114.9 },
      { name: '宜春', longitude: 114.4 },
      { name: '抚州', longitude: 116.4 },
      { name: '上饶', longitude: 117.9 },
    ],
  },
  {
    name: '山东省',
    cities: [
      { name: '济南', longitude: 117.0 },
      { name: '青岛', longitude: 120.4 },
      { name: '淄博', longitude: 118.1 },
      { name: '枣庄', longitude: 117.6 },
      { name: '东营', longitude: 118.7 },
      { name: '烟台', longitude: 121.4 },
      { name: '潍坊', longitude: 119.1 },
      { name: '济宁', longitude: 116.6 },
      { name: '泰安', longitude: 117.1 },
      { name: '威海', longitude: 122.1 },
      { name: '日照', longitude: 119.5 },
      { name: '临沂', longitude: 118.4 },
      { name: '德州', longitude: 116.4 },
      { name: '聊城', longitude: 116.0 },
      { name: '滨州', longitude: 118.0 },
      { name: '菏泽', longitude: 115.5 },
    ],
  },

  // ─── 华中 ─────────────────────────────────────────────
  {
    name: '河南省',
    cities: [
      { name: '郑州', longitude: 113.6 },
      { name: '开封', longitude: 114.3 },
      { name: '洛阳', longitude: 112.5 },
      { name: '平顶山', longitude: 113.3 },
      { name: '安阳', longitude: 114.4 },
      { name: '鹤壁', longitude: 114.3 },
      { name: '新乡', longitude: 113.9 },
      { name: '焦作', longitude: 113.2 },
      { name: '濮阳', longitude: 115.0 },
      { name: '许昌', longitude: 113.8 },
      { name: '漯河', longitude: 114.0 },
      { name: '三门峡', longitude: 111.2 },
      { name: '南阳', longitude: 112.5 },
      { name: '商丘', longitude: 115.6 },
      { name: '信阳', longitude: 114.1 },
      { name: '周口', longitude: 114.7 },
      { name: '驻马店', longitude: 114.0 },
      { name: '济源', longitude: 112.6 },
    ],
  },
  {
    name: '湖北省',
    cities: [
      { name: '武汉', longitude: 114.3 },
      { name: '黄石', longitude: 115.0 },
      { name: '十堰', longitude: 110.8 },
      { name: '宜昌', longitude: 111.3 },
      { name: '襄阳', longitude: 112.1 },
      { name: '鄂州', longitude: 114.9 },
      { name: '荆门', longitude: 112.2 },
      { name: '孝感', longitude: 113.9 },
      { name: '荆州', longitude: 112.2 },
      { name: '黄冈', longitude: 114.9 },
      { name: '咸宁', longitude: 114.3 },
      { name: '随州', longitude: 113.4 },
      { name: '恩施', longitude: 109.5 },
      { name: '仙桃', longitude: 113.4 },
      { name: '潜江', longitude: 112.9 },
      { name: '天门', longitude: 113.2 },
      // ★ 2026-10-07 补省直辖县级单位（经度取 data/geo/cn-counties-2023.json）
      { name: '神农架', longitude: 110.67 },
    ],
  },
  {
    name: '湖南省',
    cities: [
      { name: '长沙', longitude: 113.0 },
      { name: '株洲', longitude: 113.1 },
      { name: '湘潭', longitude: 112.9 },
      { name: '衡阳', longitude: 112.6 },
      { name: '邵阳', longitude: 111.5 },
      { name: '岳阳', longitude: 113.1 },
      { name: '常德', longitude: 111.7 },
      { name: '张家界', longitude: 110.5 },
      { name: '益阳', longitude: 112.4 },
      { name: '郴州', longitude: 113.0 },
      { name: '永州', longitude: 111.6 },
      { name: '怀化', longitude: 110.0 },
      { name: '娄底', longitude: 112.0 },
      { name: '湘西', longitude: 109.7 },
    ],
  },

  // ─── 华南 ─────────────────────────────────────────────
  {
    name: '广东省',
    cities: [
      { name: '广州', longitude: 113.3 },
      { name: '深圳', longitude: 114.1 },
      { name: '珠海', longitude: 113.6 },
      { name: '佛山', longitude: 113.1 },
      { name: '东莞', longitude: 113.8 },
      { name: '中山', longitude: 113.4 },
      { name: '江门', longitude: 113.1 },
      { name: '惠州', longitude: 114.4 },
      { name: '汕头', longitude: 116.7 },
      { name: '湛江', longitude: 110.4 },
      { name: '茂名', longitude: 110.9 },
      { name: '肇庆', longitude: 112.5 },
      { name: '梅州', longitude: 116.1 },
      { name: '韶关', longitude: 113.6 },
      { name: '阳江', longitude: 111.9 },
      { name: '清远', longitude: 113.1 },
      { name: '潮州', longitude: 116.6 },
      { name: '揭阳', longitude: 116.4 },
      { name: '云浮', longitude: 112.0 },
      { name: '汕尾', longitude: 115.4 },
      { name: '河源', longitude: 114.7 },
    ],
  },
  {
    name: '广西壮族自治区',
    cities: [
      { name: '南宁', longitude: 108.3 },
      { name: '柳州', longitude: 109.4 },
      { name: '桂林', longitude: 110.3 },
      { name: '梧州', longitude: 111.3 },
      { name: '北海', longitude: 109.1 },
      { name: '防城港', longitude: 108.4 },
      { name: '钦州', longitude: 108.6 },
      { name: '贵港', longitude: 109.6 },
      { name: '玉林', longitude: 110.2 },
      { name: '百色', longitude: 106.6 },
      { name: '贺州', longitude: 111.6 },
      { name: '河池', longitude: 108.1 },
      { name: '来宾', longitude: 109.2 },
      { name: '崇左', longitude: 107.4 },
    ],
  },
  {
    name: '海南省',
    cities: [
      { name: '海口', longitude: 110.3 },
      { name: '三亚', longitude: 109.5 },
      { name: '儋州', longitude: 109.6 },
      { name: '文昌', longitude: 110.8 },
      { name: '琼海', longitude: 110.5 },
      { name: '万宁', longitude: 110.4 },
      { name: '陵水', longitude: 110.0 },
      { name: '乐东', longitude: 109.2 },
      { name: '五指山', longitude: 109.5 },
      // ★ 2026-10-07 补齐省直辖市县（经度取 data/geo/cn-counties-2023.json）
      { name: '东方', longitude: 108.65 },
      { name: '定安', longitude: 110.33 },
      { name: '屯昌', longitude: 110.1 },
      { name: '澄迈', longitude: 109.99 },
      { name: '临高', longitude: 109.71 },
      { name: '白沙', longitude: 109.45 },
      { name: '昌江', longitude: 109.08 },
      { name: '保亭', longitude: 109.67 },
      { name: '琼中', longitude: 109.85 },
      { name: '三沙（中国最南）', longitude: 112.3 },
    ],
  },

  // ─── 西南 ─────────────────────────────────────────────
  {
    name: '四川省',
    cities: [
      { name: '成都', longitude: 104.1 },
      { name: '绵阳', longitude: 104.7 },
      { name: '德阳', longitude: 104.4 },
      { name: '宜宾', longitude: 104.6 },
      { name: '泸州', longitude: 105.4 },
      { name: '达州', longitude: 107.5 },
      { name: '南充', longitude: 106.1 },
      { name: '乐山', longitude: 103.8 },
      { name: '自贡', longitude: 104.8 },
      { name: '攀枝花', longitude: 101.7 },
      { name: '遂宁', longitude: 105.6 },
      { name: '内江', longitude: 105.1 },
      { name: '广元', longitude: 105.8 },
      { name: '雅安', longitude: 103.0 },
      { name: '巴中', longitude: 106.8 },
      { name: '资阳', longitude: 104.6 },
      { name: '广安', longitude: 106.6 },
      { name: '眉山', longitude: 103.8 },
      { name: '凉山', longitude: 102.3 },
      { name: '甘孜', longitude: 101.9 },
      { name: '阿坝', longitude: 102.2 },
    ],
  },
  {
    name: '贵州省',
    cities: [
      { name: '贵阳', longitude: 106.7 },
      { name: '遵义', longitude: 106.9 },
      { name: '六盘水', longitude: 104.8 },
      { name: '安顺', longitude: 105.9 },
      { name: '毕节', longitude: 105.3 },
      { name: '铜仁', longitude: 109.2 },
      { name: '黔西南', longitude: 104.9 },
      { name: '黔东南', longitude: 107.9 },
      { name: '黔南', longitude: 107.5 },
    ],
  },
  {
    name: '云南省',
    cities: [
      { name: '昆明', longitude: 102.7 },
      { name: '曲靖', longitude: 103.8 },
      { name: '玉溪', longitude: 102.5 },
      { name: '保山', longitude: 99.2 },
      { name: '昭通', longitude: 103.7 },
      { name: '丽江', longitude: 100.2 },
      { name: '普洱', longitude: 101.0 },
      { name: '临沧', longitude: 100.1 },
      { name: '楚雄', longitude: 101.5 },
      { name: '红河', longitude: 103.5 },
      { name: '文山', longitude: 104.2 },
      { name: '西双版纳', longitude: 100.8 },
      { name: '大理', longitude: 100.2 },
      { name: '德宏', longitude: 98.6 },
      { name: '怒江', longitude: 98.8 },
      { name: '迪庆', longitude: 99.7 },
    ],
  },
  {
    name: '西藏自治区',
    cities: [
      { name: '拉萨', longitude: 91.1 },
      { name: '日喀则', longitude: 88.9 },
      { name: '昌都', longitude: 97.2 },
      { name: '林芝', longitude: 94.4 },
      { name: '山南', longitude: 91.8 },
      { name: '那曲', longitude: 92.1 },
      { name: '阿里', longitude: 80.1 },
    ],
  },

  // ─── 西北 ─────────────────────────────────────────────
  {
    name: '陕西省',
    cities: [
      { name: '西安', longitude: 108.9 },
      { name: '咸阳', longitude: 108.7 },
      { name: '宝鸡', longitude: 107.2 },
      { name: '铜川', longitude: 109.1 },
      { name: '渭南', longitude: 109.5 },
      { name: '延安', longitude: 109.5 },
      { name: '汉中', longitude: 107.1 },
      { name: '榆林', longitude: 109.7 },
      { name: '安康', longitude: 109.0 },
      { name: '商洛', longitude: 109.9 },
    ],
  },
  {
    name: '甘肃省',
    cities: [
      { name: '兰州', longitude: 103.8 },
      { name: '嘉峪关', longitude: 98.3 },
      { name: '金昌', longitude: 102.2 },
      { name: '白银', longitude: 104.2 },
      { name: '天水', longitude: 105.7 },
      { name: '武威', longitude: 102.6 },
      { name: '张掖', longitude: 100.5 },
      { name: '平凉', longitude: 106.7 },
      { name: '酒泉', longitude: 98.5 },
      { name: '庆阳', longitude: 107.6 },
      { name: '定西', longitude: 104.6 },
      { name: '陇南', longitude: 104.9 },
      { name: '临夏', longitude: 103.2 },
      { name: '甘南', longitude: 102.9 },
    ],
  },
  {
    name: '青海省',
    cities: [
      { name: '西宁', longitude: 101.8 },
      { name: '海东', longitude: 102.1 },
      { name: '格尔木', longitude: 94.9 },
      { name: '德令哈', longitude: 97.4 },
      { name: '玉树', longitude: 97.0 },
      { name: '果洛', longitude: 100.2 },
      { name: '海西', longitude: 97.4 },
      { name: '海北', longitude: 100.9 },
      { name: '黄南', longitude: 102.0 },
      { name: '海南州', longitude: 100.6 },
    ],
  },
  {
    name: '宁夏回族自治区',
    cities: [
      { name: '银川', longitude: 106.3 },
      { name: '石嘴山', longitude: 106.4 },
      { name: '吴忠', longitude: 106.2 },
      { name: '固原', longitude: 106.3 },
      { name: '中卫', longitude: 105.2 },
    ],
  },
  {
    name: '新疆维吾尔自治区',
    cities: [
      { name: '乌鲁木齐', longitude: 87.6 },
      { name: '克拉玛依', longitude: 84.9 },
      { name: '吐鲁番', longitude: 89.2 },
      { name: '哈密', longitude: 93.5 },
      { name: '昌吉', longitude: 87.3 },
      { name: '博尔塔拉', longitude: 82.1 },
      { name: '巴音郭楞', longitude: 86.2 },
      { name: '阿克苏', longitude: 80.3 },
      { name: '克孜勒苏', longitude: 76.2 },
      { name: '喀什', longitude: 75.9 },
      { name: '和田', longitude: 79.9 },
      { name: '伊犁', longitude: 81.3 },
      { name: '塔城', longitude: 83.0 },
      { name: '阿勒泰', longitude: 88.1 },
      { name: '石河子', longitude: 86.1 },
      // ★ 2026-10-07 补齐自治区直辖县级市（兵团各市，经度取 data/geo/cn-counties-2023.json）
      { name: '阿拉尔', longitude: 81.27 },
      { name: '图木舒克', longitude: 79.07 },
      { name: '五家渠', longitude: 87.54 },
      { name: '北屯', longitude: 87.82 },
      { name: '铁门关', longitude: 85.65 },
      { name: '双河', longitude: 82.35 },
      { name: '可克达拉', longitude: 81.0 },
      { name: '昆玉', longitude: 79.29 },
      { name: '胡杨河', longitude: 84.83 },
      { name: '新星', longitude: 93.75 },
      { name: '白杨', longitude: 82.9 },
      { name: '塔什库尔干（中国最西）', longitude: 75.2 },
    ],
  },

  // ─── 特别行政区 / 台湾 ──────────────────────────────────
  {
    name: '香港特别行政区',
    cities: [
      { name: '香港', longitude: 114.2 },
      { name: '九龙', longitude: 114.2 },
      { name: '新界', longitude: 114.2 },
    ],
  },
  {
    name: '澳门特别行政区',
    cities: [
      { name: '澳门', longitude: 113.5 },
      { name: '氹仔', longitude: 113.6 },
      { name: '路环', longitude: 113.6 },
    ],
  },
  {
    name: '台湾省',
    cities: [
      { name: '台北', longitude: 121.5 },
      { name: '新北', longitude: 121.5 },
      { name: '桃园', longitude: 121.3 },
      { name: '台中', longitude: 120.7 },
      { name: '台南', longitude: 120.2 },
      { name: '高雄', longitude: 120.3 },
      { name: '基隆', longitude: 121.7 },
      { name: '新竹', longitude: 120.9 },
      { name: '嘉义', longitude: 120.4 },
      { name: '苗栗', longitude: 120.8 },
      { name: '彰化', longitude: 120.5 },
      { name: '南投', longitude: 120.7 },
      { name: '云林', longitude: 120.5 },
      { name: '屏东', longitude: 120.5 },
      { name: '宜兰', longitude: 121.7 },
      { name: '花莲', longitude: 121.6 },
      { name: '台东', longitude: 121.1 },
      { name: '澎湖', longitude: 119.6 },
      { name: '金门', longitude: 118.3 },
      { name: '连江', longitude: 119.9 },
      { name: '马祖', longitude: 119.93, lon: 119.93, lat: 26.16, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
    ],
  },

  // ─── 海外国家/地区（源自 ziwei-fortune CITY_GEO_DB，按国家分组） ───
  // 泰国 (TH)
  {
    name: '泰国',
    cities: [
      { name: '泰国', longitude: 100.50, lon: 100.50, lat: 13.76, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
      { name: '曼谷', longitude: 100.50, lon: 100.50, lat: 13.76, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
      { name: '清迈', longitude: 98.98, lon: 98.98, lat: 18.79, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
      { name: '普吉', longitude: 98.39, lon: 98.39, lat: 7.88, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
      { name: '芭达雅', longitude: 100.88, lon: 100.88, lat: 12.93, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
      { name: '芭提雅', longitude: 100.88, lon: 100.88, lat: 12.93, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
    ],
  },
  // 新加坡 (SG)
  {
    name: '新加坡',
    cities: [
      { name: '新加坡', longitude: 103.82, lon: 103.82, lat: 1.35, tz: 8, utcOffsetMinutes: 480, country: 'SG' },
    ],
  },
  // 马来西亚 (MY)
  {
    name: '马来西亚',
    cities: [
      { name: '吉隆坡', longitude: 101.69, lon: 101.69, lat: 3.14, tz: 8, utcOffsetMinutes: 480, country: 'MY' },
      { name: '槟城', longitude: 100.33, lon: 100.33, lat: 5.41, tz: 8, utcOffsetMinutes: 480, country: 'MY' },
    ],
  },
  // 印度尼西亚 (ID)
  {
    name: '印度尼西亚',
    cities: [
      { name: '雅加达', longitude: 106.85, lon: 106.85, lat: -6.21, tz: 7, utcOffsetMinutes: 420, country: 'ID' },
    ],
  },
  // 菲律宾 (PH)
  {
    name: '菲律宾',
    cities: [
      { name: '马尼拉', longitude: 120.98, lon: 120.98, lat: 14.60, tz: 8, utcOffsetMinutes: 480, country: 'PH' },
    ],
  },
  // 越南 (VN)
  {
    name: '越南',
    cities: [
      { name: '河内', longitude: 105.83, lon: 105.83, lat: 21.03, tz: 7, utcOffsetMinutes: 420, country: 'VN' },
      { name: '胡志明市', longitude: 106.63, lon: 106.63, lat: 10.82, tz: 7, utcOffsetMinutes: 420, country: 'VN' },
    ],
  },
  // 日本 (JP)
  {
    name: '日本',
    cities: [
      { name: '东京', longitude: 139.69, lon: 139.69, lat: 35.69, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
      { name: '大阪', longitude: 135.50, lon: 135.50, lat: 34.69, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
      { name: '京都', longitude: 135.77, lon: 135.77, lat: 35.01, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
      { name: '横滨', longitude: 139.64, lon: 139.64, lat: 35.44, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
      { name: '名古屋', longitude: 136.91, lon: 136.91, lat: 35.18, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
      { name: '札幌', longitude: 141.35, lon: 141.35, lat: 43.06, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
    ],
  },
  // 韩国 (KR)
  {
    name: '韩国',
    cities: [
      { name: '首尔', longitude: 126.98, lon: 126.98, lat: 37.57, tz: 9, utcOffsetMinutes: 540, country: 'KR' },
      { name: '釜山', longitude: 129.08, lon: 129.08, lat: 35.18, tz: 9, utcOffsetMinutes: 540, country: 'KR' },
    ],
  },
  // 英国 (UK)
  {
    name: '英国',
    cities: [
      { name: '伦敦', longitude: -0.13, lon: -0.13, lat: 51.51, tz: 0, utcOffsetMinutes: 0, country: 'UK' },
    ],
  },
  // 法国 (FR)
  {
    name: '法国',
    cities: [
      { name: '巴黎', longitude: 2.35, lon: 2.35, lat: 48.86, tz: 1, utcOffsetMinutes: 60, country: 'FR' },
    ],
  },
  // 美国 (US)
  {
    name: '美国',
    cities: [
      { name: '纽约', longitude: -74.01, lon: -74.01, lat: 40.71, tz: -5, utcOffsetMinutes: -300, country: 'US' },
      { name: '旧金山', longitude: -122.42, lon: -122.42, lat: 37.77, tz: -8, utcOffsetMinutes: -480, country: 'US' },
      { name: '洛杉矶', longitude: -118.24, lon: -118.24, lat: 34.05, tz: -8, utcOffsetMinutes: -480, country: 'US' },
    ],
  },
  // 澳大利亚 (AU)
  {
    name: '澳大利亚',
    cities: [
      { name: '悉尼', longitude: 151.21, lon: 151.21, lat: -33.87, tz: 10, utcOffsetMinutes: 600, country: 'AU' },
      { name: '雪梨', longitude: 151.21, lon: 151.21, lat: -33.87, tz: 10, utcOffsetMinutes: 600, country: 'AU' },
    ],
  },

  // 注：海外出生在 share.ts 真太阳时算法中默认假设输入为北京时间(UTC+8)。
  // 如需按各城市时区做真太阳时校正，可结合下方 CITY_GEO_DB 的 tz / utcOffsetMinutes 字段。
];

// ─── 城市经纬度与时区扩展表（源自 ziwei-fortune CITY_GEO_DB）──────────────────
// 同名城市经度以 ziwei-doushu 现有 PROVINCES 为准，保留 name / lon / lat / tz / country 并附加 utcOffsetMinutes = tz * 60。
export const CITY_GEO_DB: Record<string, CityGeoRecord> = {
  // 台湾 (TW) — 同名城市 lon 取自本表 PROVINCES
  '台北': { name: '台北', lon: 121.5, lat: 25.03, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '新北': { name: '新北', lon: 121.5, lat: 25.01, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '基隆': { name: '基隆', lon: 121.7, lat: 25.13, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '桃园': { name: '桃园', lon: 121.3, lat: 24.99, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '新竹': { name: '新竹', lon: 120.9, lat: 24.80, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '苗栗': { name: '苗栗', lon: 120.8, lat: 24.56, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '台中': { name: '台中', lon: 120.7, lat: 24.15, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '彰化': { name: '彰化', lon: 120.5, lat: 24.08, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '南投': { name: '南投', lon: 120.7, lat: 23.91, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '云林': { name: '云林', lon: 120.5, lat: 23.71, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '嘉义': { name: '嘉义', lon: 120.4, lat: 23.48, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '台南': { name: '台南', lon: 120.2, lat: 23.00, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '高雄': { name: '高雄', lon: 120.3, lat: 22.63, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '屏东': { name: '屏东', lon: 120.5, lat: 22.67, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '宜兰': { name: '宜兰', lon: 121.7, lat: 24.76, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '花莲': { name: '花莲', lon: 121.6, lat: 23.98, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '台东': { name: '台东', lon: 121.1, lat: 22.75, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '澎湖': { name: '澎湖', lon: 119.6, lat: 23.57, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '金门': { name: '金门', lon: 118.3, lat: 24.43, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '连江': { name: '连江', lon: 119.9, lat: 26.16, tz: 8, utcOffsetMinutes: 480, country: 'TW' },
  '马祖': { name: '马祖', lon: 119.93, lat: 26.16, tz: 8, utcOffsetMinutes: 480, country: 'TW' },

  // 港澳 (HK / MO) — 同名城市 lon 取自本表 PROVINCES
  '香港': { name: '香港', lon: 114.2, lat: 22.32, tz: 8, utcOffsetMinutes: 480, country: 'HK' },
  '澳门': { name: '澳门', lon: 113.5, lat: 22.20, tz: 8, utcOffsetMinutes: 480, country: 'MO' },

  // 中国大陆 (CN) — 同名城市 lon 取自本表 PROVINCES
  '北京': { name: '北京', lon: 116.4, lat: 39.90, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '上海': { name: '上海', lon: 121.5, lat: 31.23, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '广州': { name: '广州', lon: 113.3, lat: 23.13, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '深圳': { name: '深圳', lon: 114.1, lat: 22.54, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '东莞': { name: '东莞', lon: 113.8, lat: 23.02, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '佛山': { name: '佛山', lon: 113.1, lat: 23.02, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '珠海': { name: '珠海', lon: 113.6, lat: 22.27, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '杭州': { name: '杭州', lon: 120.2, lat: 30.27, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '宁波': { name: '宁波', lon: 121.6, lat: 29.87, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '温州': { name: '温州', lon: 120.7, lat: 28.00, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '南京': { name: '南京', lon: 118.8, lat: 32.06, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '苏州': { name: '苏州', lon: 120.6, lat: 31.30, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '无锡': { name: '无锡', lon: 120.3, lat: 31.49, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '成都': { name: '成都', lon: 104.1, lat: 30.57, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '重庆': { name: '重庆', lon: 106.6, lat: 29.56, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '武汉': { name: '武汉', lon: 114.3, lat: 30.59, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '长沙': { name: '长沙', lon: 112.9, lat: 28.23, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '郑州': { name: '郑州', lon: 113.7, lat: 34.75, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '西安': { name: '西安', lon: 108.9, lat: 34.34, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '天津': { name: '天津', lon: 117.2, lat: 39.08, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '青岛': { name: '青岛', lon: 120.4, lat: 36.07, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '济南': { name: '济南', lon: 117.0, lat: 36.65, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '厦门': { name: '厦门', lon: 118.1, lat: 24.48, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '福州': { name: '福州', lon: 119.3, lat: 26.08, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '泉州': { name: '泉州', lon: 118.7, lat: 24.87, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '沈阳': { name: '沈阳', lon: 123.4, lat: 41.80, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '大连': { name: '大连', lon: 121.6, lat: 38.91, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '哈尔滨': { name: '哈尔滨', lon: 126.6, lat: 45.80, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '长春': { name: '长春', lon: 125.3, lat: 43.82, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '昆明': { name: '昆明', lon: 102.7, lat: 24.88, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '南宁': { name: '南宁', lon: 108.4, lat: 22.82, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '贵阳': { name: '贵阳', lon: 106.7, lat: 26.65, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '合肥': { name: '合肥', lon: 117.2, lat: 31.82, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '南昌': { name: '南昌', lon: 115.9, lat: 28.68, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '太原': { name: '太原', lon: 112.5, lat: 37.87, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '石家庄': { name: '石家庄', lon: 114.5, lat: 38.04, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '兰州': { name: '兰州', lon: 103.8, lat: 36.06, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '乌鲁木齐': { name: '乌鲁木齐', lon: 87.6, lat: 43.83, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '拉萨': { name: '拉萨', lon: 91.1, lat: 29.65, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '海口': { name: '海口', lon: 110.3, lat: 20.04, tz: 8, utcOffsetMinutes: 480, country: 'CN' },
  '三亚': { name: '三亚', lon: 109.5, lat: 18.25, tz: 8, utcOffsetMinutes: 480, country: 'CN' },

  // 泰国 (TH)
  '泰国': { name: '泰国(曼谷)', lon: 100.50, lat: 13.76, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
  '曼谷': { name: '曼谷', lon: 100.50, lat: 13.76, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
  '清迈': { name: '清迈', lon: 98.98, lat: 18.79, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
  '普吉': { name: '普吉', lon: 98.39, lat: 7.88, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
  '芭达雅': { name: '芭达雅', lon: 100.88, lat: 12.93, tz: 7, utcOffsetMinutes: 420, country: 'TH' },
  '芭提雅': { name: '芭达雅', lon: 100.88, lat: 12.93, tz: 7, utcOffsetMinutes: 420, country: 'TH' },

  // 新加坡 (SG)
  '新加坡': { name: '新加坡', lon: 103.82, lat: 1.35, tz: 8, utcOffsetMinutes: 480, country: 'SG' },

  // 马来西亚 (MY)
  '吉隆坡': { name: '吉隆坡', lon: 101.69, lat: 3.14, tz: 8, utcOffsetMinutes: 480, country: 'MY' },
  '槟城': { name: '槟城', lon: 100.33, lat: 5.41, tz: 8, utcOffsetMinutes: 480, country: 'MY' },

  // 印度尼西亚 (ID)
  '雅加达': { name: '雅加达', lon: 106.85, lat: -6.21, tz: 7, utcOffsetMinutes: 420, country: 'ID' },

  // 菲律宾 (PH)
  '马尼拉': { name: '马尼拉', lon: 120.98, lat: 14.60, tz: 8, utcOffsetMinutes: 480, country: 'PH' },

  // 越南 (VN)
  '河内': { name: '河内', lon: 105.83, lat: 21.03, tz: 7, utcOffsetMinutes: 420, country: 'VN' },
  '胡志明市': { name: '胡志明市', lon: 106.63, lat: 10.82, tz: 7, utcOffsetMinutes: 420, country: 'VN' },

  // 日本 (JP)
  '东京': { name: '东京', lon: 139.69, lat: 35.69, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
  '大阪': { name: '大阪', lon: 135.50, lat: 34.69, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
  '京都': { name: '京都', lon: 135.77, lat: 35.01, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
  '横滨': { name: '横滨', lon: 139.64, lat: 35.44, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
  '名古屋': { name: '名古屋', lon: 136.91, lat: 35.18, tz: 9, utcOffsetMinutes: 540, country: 'JP' },
  '札幌': { name: '札幌', lon: 141.35, lat: 43.06, tz: 9, utcOffsetMinutes: 540, country: 'JP' },

  // 韩国 (KR)
  '首尔': { name: '首尔', lon: 126.98, lat: 37.57, tz: 9, utcOffsetMinutes: 540, country: 'KR' },
  '釜山': { name: '釜山', lon: 129.08, lat: 35.18, tz: 9, utcOffsetMinutes: 540, country: 'KR' },

  // 英国 (UK)
  '伦敦': { name: '伦敦', lon: -0.13, lat: 51.51, tz: 0, utcOffsetMinutes: 0, country: 'UK' },

  // 法国 (FR)
  '巴黎': { name: '巴黎', lon: 2.35, lat: 48.86, tz: 1, utcOffsetMinutes: 60, country: 'FR' },

  // 美国 (US)
  '纽约': { name: '纽约', lon: -74.01, lat: 40.71, tz: -5, utcOffsetMinutes: -300, country: 'US' },
  '旧金山': { name: '旧金山', lon: -122.42, lat: 37.77, tz: -8, utcOffsetMinutes: -480, country: 'US' },
  '洛杉矶': { name: '洛杉矶', lon: -118.24, lat: 34.05, tz: -8, utcOffsetMinutes: -480, country: 'US' },

  // 澳大利亚 (AU)
  '悉尼': { name: '悉尼', lon: 151.21, lat: -33.87, tz: 10, utcOffsetMinutes: 600, country: 'AU' },
  '雪梨': { name: '雪梨', lon: 151.21, lat: -33.87, tz: 10, utcOffsetMinutes: 600, country: 'AU' },
};

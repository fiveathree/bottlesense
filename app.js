// 雙語分類與產區對照表
const I18N_TERMS = {
  "威士忌": { zh: "威士忌", en: "Whisky" },
  "紅酒": { zh: "紅酒", en: "Red Wine" },
  "白酒": { zh: "白酒", en: "White Wine" },
  "清酒": { zh: "清酒", en: "Sake" },
  "氣泡酒": { zh: "氣泡酒", en: "Sparkling Wine" },
  "香檳": { zh: "香檳", en: "Champagne" },
  "啤酒": { zh: "啤酒", en: "Beer" },
  "琴酒": { zh: "琴酒", en: "Gin" },
  "蘭姆酒": { zh: "蘭姆酒", en: "Rum" },
  "白蘭地": { zh: "白蘭地", en: "Brandy" },
  "利口酒": { zh: "利口酒", en: "Liqueur" },
  "泡盛": { zh: "泡盛", en: "Awamori" },
  "伏特加": { zh: "伏特加", en: "Vodka" },
  "龍舌蘭": { zh: "龍舌蘭", en: "Tequila" },
  "酒類": { zh: "酒類", en: "Liquor" },
  "蘇格蘭": { zh: "蘇格蘭", en: "Scotland" },
  "法國": { zh: "法國", en: "France" },
  "日本": { zh: "日本", en: "Japan" },
  "美國": { zh: "美國", en: "USA" },
  "義大利": { zh: "義大利", en: "Italy" },
  "無年份": { zh: "無年份", en: "NV" }
};

function formatFilterLabel(val) {
  if (!val) return "";
  if (I18N_TERMS[val]) return I18N_TERMS[val][currentLang] || val;
  for (const [k, v] of Object.entries(I18N_TERMS)) {
    if (val.includes(k) || val.toLowerCase() === v.en.toLowerCase()) {
      return v[currentLang];
    }
  }
  return val;
}

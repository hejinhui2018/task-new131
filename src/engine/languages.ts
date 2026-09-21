import type { LanguageCode, StageElementSpec } from './types';

export interface LanguageDef {
  code: LanguageCode;
  label: string;
  /** 验收台示例文本：刻意包含容易触发问题的字符与长度 */
  samples: {
    title: string;
    body: string;
    button: string;
  };
}

export const LANGUAGES: Record<LanguageCode, LanguageDef> = {
  de: {
    code: 'de',
    label: 'Deutsch',
    // 长复合词 + ä/ö/ü/ß：换字体后字宽变化导致按钮换行
    samples: {
      title: 'Schriftarten-Wechsel bestätigen',
      body: 'Die neue variable Markenschrift wird schrittweise ausgeliefert. Überprüfen Sie Umbruch, Schriftgewicht und Layoutverschiebung auf einer schmalen Button-Breite.',
      button: 'Jetzt kostenlos herunterladen und ausprobieren',
    },
  },
  vi: {
    code: 'vi',
    label: 'Tiếng Việt',
    // ấ ầ ử 等越南语带调元音：若只打 latin 子集就会缺字回落
    samples: {
      title: 'Xác nhận chuyển đổi kiểu chữ thương hiệu',
      body: 'Kiểm tra các ký tự có dấu như ấ, ầ, ử, ữ và việc xuống dòng trên thiết bị di động với kết nối chậm.',
      button: 'Tải xuống miễn phí ngay bây giờ',
    },
  },
  zh: {
    code: 'zh',
    label: '中文',
    samples: {
      title: '确认品牌字体切换',
      body: '可变字体将分批发布。请检查首屏文字在慢网、缓存命中与加载失败时的匹配字体、换行与布局偏移。',
      button: '立即免费下载体验',
    },
  },
  en: {
    code: 'en',
    label: 'English',
    samples: {
      title: 'Confirm the brand font switch',
      body: 'The new variable brand font ships gradually. Verify matching, wrapping and layout shift from first paint to stable across slow networks and cache hits.',
      button: 'Download free and try now',
    },
  },
};

export function makeElements(language: LanguageCode): StageElementSpec[] {
  const s = LANGUAGES[language].samples;
  return [
    {
      id: 'title',
      kind: 'title',
      language,
      text: s.title,
      weight: 700,
      paddingX: 0,
    },
    {
      id: 'body',
      kind: 'body',
      language,
      text: s.body,
      weight: 400,
      paddingX: 0,
    },
    {
      id: 'button',
      kind: 'button',
      language,
      text: s.button,
      weight: 600,
      paddingX: 32,
      maxWidth: 240,
    },
  ];
}

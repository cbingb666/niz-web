import type { Locale } from '@/i18n/core';

interface ManualModel {
  modelId: string;
  name: string;
  variants: {
    id: string;
    kind: 'wired' | 'wireless' | 'rgb';
    files: { format: 'pdf' | 'word'; language: Locale; path: string }[];
  }[];
}

// Original file paths from drivers/manuals-2023-06.json. Only links are bundled.
export const keyboardManuals: readonly ManualModel[] = [
  {
    "modelId": "atom66",
    "name": "ATOM66",
    "variants": [
      {
        "id": "66EC(S)",
        "kind": "wired",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/ATOM66/manuals/2023-06/66EC键盘布局图及功能说明 2023.06.14/Atom66静电容有线键盘布局图及功能说明2023.05.19.pdf"
          },
          {
            "format": "word",
            "language": "en",
            "path": "drivers/ATOM66/manuals/2023-06/帮助手册 User Manual/66EC(S) User Manual.doc"
          },
          {
            "format": "word",
            "language": "zh-CN",
            "path": "drivers/ATOM66/manuals/2023-06/帮助手册 User Manual/66EC(S) 帮助手册.doc"
          }
        ]
      },
      {
        "id": "66EC(S)Ble",
        "kind": "wireless",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/ATOM66/manuals/2023-06/66EC键盘布局图及功能说明 2023.06.14/Atom66静电容三模键盘布局图及功能说明2023.05.19.pdf"
          },
          {
            "format": "word",
            "language": "en",
            "path": "drivers/ATOM66/manuals/2023-06/帮助手册 User Manual/66EC(S)Ble User Manual.doc"
          },
          {
            "format": "word",
            "language": "zh-CN",
            "path": "drivers/ATOM66/manuals/2023-06/帮助手册 User Manual/66EC(S)Ble 帮助手册.doc"
          }
        ]
      },
      {
        "id": "66EC(XRGB)Ble",
        "kind": "rgb",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/ATOM66/manuals/2023-06/66EC键盘布局图及功能说明 2023.06.14/Atom66静电容RGB三模键盘布局图及功能说明2023.05.19.pdf"
          },
          {
            "format": "word",
            "language": "en",
            "path": "drivers/ATOM66/manuals/2023-06/帮助手册 User Manual/66EC(XRGB)Ble User Manual.doc"
          },
          {
            "format": "word",
            "language": "zh-CN",
            "path": "drivers/ATOM66/manuals/2023-06/帮助手册 User Manual/66EC(XRGB)Ble 帮助手册.doc"
          }
        ]
      }
    ]
  },
  {
    "modelId": "atom68",
    "name": "ATOM68",
    "variants": [
      {
        "id": "68EC(S)",
        "kind": "wired",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/ATOM68/manuals/2023-06/68布局图及功能说明2023.06.14/Atom68静电容有线键盘布局图及功能说明2023.05.20.pdf"
          }
        ]
      },
      {
        "id": "68EC(S)Ble",
        "kind": "wireless",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/ATOM68/manuals/2023-06/68布局图及功能说明2023.06.14/Atom68静电容三模键盘布局图及功能说明2023.05.20.pdf"
          }
        ]
      },
      {
        "id": "68EC(XRGB)Ble",
        "kind": "rgb",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/ATOM68/manuals/2023-06/68布局图及功能说明2023.06.14/Atom68静电容RGB三模键盘布局图及功能说明2023.05.20.pdf"
          },
          {
            "format": "word",
            "language": "en",
            "path": "drivers/ATOM68/68EC(XRGB)Ble User Manual.doc"
          },
          {
            "format": "word",
            "language": "zh-CN",
            "path": "drivers/ATOM68/manuals/2023-06/帮助手册 User Manual/68EC(XRGB)Ble 帮助手册.doc"
          }
        ]
      }
    ]
  },
  {
    "modelId": "micro82",
    "name": "MICRO82",
    "variants": [
      {
        "id": "82EC(S)",
        "kind": "wired",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/MICRO82/manuals/2023-06/82EC布局图及功能说明2023.06.14/Micro82静电容有线键盘布局图及功能说明2023.05.20.pdf"
          }
        ]
      },
      {
        "id": "82EC(S)Ble",
        "kind": "wireless",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/MICRO82/manuals/2023-06/82EC布局图及功能说明2023.06.14/Micro82静电容三模键盘布局图及功能说明2023.05.20.pdf"
          }
        ]
      },
      {
        "id": "82EC(XRGB)Ble",
        "kind": "rgb",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/MICRO82/manuals/2023-06/82EC布局图及功能说明2023.06.14/Micro82静电容RGB三模键盘布局图及功能说明2023.05.20.pdf"
          },
          {
            "format": "word",
            "language": "en",
            "path": "drivers/MICRO82/manuals/2023-06/帮助手册 User Manual/82EC(XRGB)Ble User Manual.doc"
          },
          {
            "format": "word",
            "language": "zh-CN",
            "path": "drivers/MICRO82/manuals/2023-06/帮助手册 User Manual/82EC(XRGB)Ble 帮助手册.doc"
          }
        ]
      }
    ]
  },
  {
    "modelId": "micro84",
    "name": "MICRO84",
    "variants": [
      {
        "id": "84EC(S)",
        "kind": "wired",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/MICRO84/manuals/2023-06/84EC(新)键盘布局图及功能说明 2023.06.14/Micro84静电容有线键盘布局图及功能说明2023.05.20.pdf"
          },
          {
            "format": "word",
            "language": "en",
            "path": "drivers/MICRO84/manuals/2023-06/帮助手册 User Manual/84EC(S) User Manual.doc"
          },
          {
            "format": "word",
            "language": "zh-CN",
            "path": "drivers/MICRO84/manuals/2023-06/帮助手册 User Manual/84EC(S) 帮助手册.doc"
          }
        ]
      },
      {
        "id": "84EC(S)Ble",
        "kind": "wireless",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/MICRO84/manuals/2023-06/84EC(新)键盘布局图及功能说明 2023.06.14/Micro84静电容三模键盘布局图及功能说明2023.05.20.pdf"
          },
          {
            "format": "word",
            "language": "en",
            "path": "drivers/MICRO84/manuals/2023-06/帮助手册 User Manual/84EC(S)Ble User Manual.doc"
          },
          {
            "format": "word",
            "language": "zh-CN",
            "path": "drivers/MICRO84/manuals/2023-06/帮助手册 User Manual/84EC(S)Ble 帮助手册.doc"
          }
        ]
      },
      {
        "id": "84EC(XRGB)Ble",
        "kind": "rgb",
        "files": [
          {
            "format": "pdf",
            "language": "zh-CN",
            "path": "drivers/MICRO84/manuals/2023-06/84EC(新)键盘布局图及功能说明 2023.06.14/Micro84静电容RGB三模键盘布局图及功能说明2023.05.20.pdf"
          },
          {
            "format": "word",
            "language": "en",
            "path": "drivers/MICRO84/manuals/2023-06/帮助手册 User Manual/84EC(XRGB)Ble User Manual.doc"
          },
          {
            "format": "word",
            "language": "zh-CN",
            "path": "drivers/MICRO84/manuals/2023-06/帮助手册 User Manual/84EC(XRGB)Ble 帮助手册.doc"
          }
        ]
      }
    ]
  }
];

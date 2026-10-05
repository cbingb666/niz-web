import { translate, type Locale } from './core.ts';

// Canonical names remain accepted in saved text and legacy callers. Wire codes do not change.
export const KEY_NAMES =
  "未设置|Esc|F1|F2|F3|F4|F5|F6|F7|F8|F9|F10|F11|F12|`|1|2|3|4|5|6|7|8|9|0|-|=|Backspace|Tab|Q|W|E|R|T|Y|U|I|O|P|[|]|\\|Caps Lock|A|S|D|F|G|H|J|K|L|;|'|Return|左 Shift|Z|X|C|V|B|N|M|,|.|/|右 Shift|左 Control|左 Command|左 Option|Space|右 Option|右 Command|Menu|右 Control|唤醒|睡眠|电源|Print Screen|Scroll Lock|Pause|Insert|Home|Page Up|Delete|End|Page Down|↑|←|↓|→|Num Lock|小键盘 /|小键盘 *|小键盘 7|小键盘 8|小键盘 9|小键盘 4|小键盘 5|小键盘 6|小键盘 1|小键盘 2|小键盘 3|小键盘 0|小键盘 .|小键盘 -|小键盘 +|小键盘 Enter|下一曲|上一曲|停止播放|播放/暂停|静音|音量 +|音量 -|媒体|邮件|计算器|我的电脑|搜索|浏览器主页|后退|前进|停止加载|刷新|收藏夹|鼠标左移|鼠标右移|鼠标上移|鼠标下移|鼠标左键|鼠标右键|鼠标中键|滚轮上|滚轮下|灯光开关|灯光宏|灯光演示|繁星|波纹|停止演示|呼吸|呼吸顺序 -|呼吸顺序 +|亮度 -|亮度 +|黄昏 / 极光|彩色呼吸|背景色切换|触发行程|键盘锁|Shift / ↑ 切换|Caps / Ctrl 切换|Win 键锁|鼠标锁|Win / Mac 切换|右 Fn|鼠标移动像素|鼠标移动间隔|编程模式切换|灯光记录 1|灯光记录 2|灯光记录 3|灯光记录 4|灯光记录 5|灯光记录 6|左 Fn|有线 / 无线切换|蓝牙设备 1|蓝牙设备 2|蓝牙设备 3|Game 模式|ECO 模式|鼠标首次延迟|按键重复速度|按键响应延迟|USB 报告率|按键扫描周期".split(
    '|',
  );
while (KEY_NAMES.length < 256) KEY_NAMES.push(`保留代码 ${KEY_NAMES.length}`);
KEY_NAMES[199] = '鼠标左键双击';
KEY_NAMES[200] = '延迟标记（宏专用）';
KEY_NAMES[204] = 'ISO \\ / |';
const macNames: Readonly<Record<number, readonly [string, string]>> = {
  207: ['Mac Fn（实验）', 'Mac Fn (experimental)'],
  208: ['屏幕亮度 −', 'Screen brightness down'],
  209: ['屏幕亮度 +', 'Screen brightness up'],
  222: ['调度中心', 'Mission Control'],
  223: ['Launchpad', 'Launchpad'],
  224: ['Spotlight', 'Spotlight'],
  225: ['听写', 'Dictation'],
  226: ['勿扰', 'Do Not Disturb'],
  227: ['系统键盘背光 −（实验）', 'System keyboard backlight down (experimental)'],
  228: ['系统键盘背光 +（实验）', 'System keyboard backlight up (experimental)'],
  229: ['快退', 'Rewind'],
  230: ['快进', 'Fast forward'],
};
for (const [code, names] of Object.entries(macNames)) KEY_NAMES[Number(code)] = names[0];

const englishOverrides: Record<number, string> = {
  '0': 'Unassigned',
  '55': 'Left Shift',
  '66': 'Right Shift',
  '67': 'Left Control',
  '68': 'Left Command',
  '69': 'Left Alt',
  '71': 'Right Alt',
  '72': 'Right Command',
  '74': 'Right Control',
  '75': 'Wake',
  '76': 'Sleep',
  '77': 'Power',
  '199': 'Mouse double-click',
  '200': 'Delay marker (macros only)',
  '204': 'ISO \\ / |',
  '92': 'Keypad /',
  '93': 'Keypad *',
  '94': 'Keypad 7',
  '95': 'Keypad 8',
  '96': 'Keypad 9',
  '97': 'Keypad 4',
  '98': 'Keypad 5',
  '99': 'Keypad 6',
  '100': 'Keypad 1',
  '101': 'Keypad 2',
  '102': 'Keypad 3',
  '103': 'Keypad 0',
  '104': 'Keypad .',
  '105': 'Keypad -',
  '106': 'Keypad +',
  '107': 'Keypad Enter',
  '108': 'Next track',
  '109': 'Previous track',
  '110': 'Stop playback',
  '111': 'Play/Pause',
  '112': 'Mute',
  '113': 'Volume up',
  '114': 'Volume down',
  '115': 'Media',
  '116': 'Mail',
  '117': 'Calculator',
  '118': 'My computer',
  '119': 'Search',
  '120': 'Browser home',
  '121': 'Back',
  '122': 'Forward',
  '123': 'Stop loading',
  '124': 'Refresh',
  '125': 'Favorites',
  '126': 'Mouse left',
  '127': 'Mouse right',
  '128': 'Mouse up',
  '129': 'Mouse down',
  '130': 'Mouse left button',
  '131': 'Mouse right button',
  '132': 'Mouse middle button',
  '133': 'Mouse wheel up',
  '134': 'Mouse wheel down',
  '135': 'Lighting toggle',
  '136': 'Lighting macro',
  '137': 'Lighting demo',
  '138': 'Stars',
  '139': 'Ripple',
  '140': 'Stop lighting demo',
  '141': 'Breathing',
  '142': 'Breathing order -',
  '143': 'Breathing order +',
  '144': 'Brightness -',
  '145': 'Brightness +',
  '146': 'Dusk / Aurora',
  '147': 'Color breathing',
  '148': 'Background color cycle',
  '149': 'Actuation travel',
  '150': 'Keyboard lock',
  '151': 'Shift / Up toggle',
  '152': 'Caps / Ctrl toggle',
  '153': 'Win key lock',
  '154': 'Mouse lock',
  '155': 'Win / Mac toggle',
  '156': 'Right Fn',
  '157': 'Mouse movement distance',
  '158': 'Mouse movement interval',
  '159': 'Programming mode toggle',
  '160': 'Lighting preset 1',
  '161': 'Lighting preset 2',
  '162': 'Lighting preset 3',
  '163': 'Lighting preset 4',
  '164': 'Lighting preset 5',
  '165': 'Lighting preset 6',
  '166': 'Left Fn',
  '167': 'Wired / Wireless toggle',
  '168': 'Bluetooth device 1',
  '169': 'Bluetooth device 2',
  '170': 'Bluetooth device 3',
  '171': 'Game mode',
  '172': 'ECO mode',
  '173': 'Initial mouse delay',
  '174': 'Key repeat rate',
  '175': 'Key response delay',
  '176': 'USB report rate',
  '177': 'Key scan period',
};
export const ENGLISH_KEY_NAMES = KEY_NAMES.map(
  (name, code) => macNames[code]?.[1] ?? englishOverrides[code] ?? (name.startsWith('保留代码 ') ? `Reserved code ${code}` : name),
);
// Shared by keycaps and editors; canonical names above stay valid for legacy input.
export const SIDED_KEY_NAMES: Readonly<Record<number, string>> = {
  55: 'L Shift', 66: 'R Shift', 67: 'L Ctrl', 74: 'R Ctrl',
  68: 'L Cmd', 72: 'R Cmd', 69: 'L Alt', 71: 'R Alt',
  156: 'R Fn', 166: 'L Fn',
};

// Share accepted input aliases with action search, including names for symbolic arrow keys.
export const KEY_ALIASES: Readonly<Record<number, readonly string[]>> = {
  0: ['none', '无功能', 'no action'],
  54: ['enter'],
  55: ['shift'],
  67: ['ctrl', 'control'],
  68: ['cmd', 'command', 'lcmd'],
  69: ['alt', 'option'],
  72: ['rcmd'],
  87: ['up', 'arrow up', 'up arrow', 'ArrowUp', '上', '向上', '上箭头', '向上箭头', '箭头上', '上方向键', '方向键上'],
  88: ['left', 'arrow left', 'left arrow', 'ArrowLeft', '左', '向左', '左箭头', '向左箭头', '箭头左', '左方向键', '方向键左'],
  89: ['down', 'arrow down', 'down arrow', 'ArrowDown', '下', '向下', '下箭头', '向下箭头', '箭头下', '下方向键', '方向键下'],
  90: ['right', 'arrow right', 'right arrow', 'ArrowRight', '右', '向右', '右箭头', '向右箭头', '箭头右', '右方向键', '方向键右'],
  156: ['rfn'],
  166: ['lfn'],
  ...Object.fromEntries(Object.keys(macNames).map(code => [code, [`保留代码 ${code}`, `Reserved code ${code}`]])),
};

// Document macOS behavior without changing key names or wire codes.
// https://docs.qmk.fm/keycodes_basic#lock-keys
// https://docs.qmk.fm/keycodes_basic#commands
export const KEY_DESCRIPTIONS: Readonly<Record<number, Readonly<Record<Locale, string>>>> = {
  79: { 'zh-CN': 'macOS：降低屏幕亮度', en: 'macOS: decrease screen brightness' },
  80: { 'zh-CN': 'macOS：提高屏幕亮度', en: 'macOS: increase screen brightness' },
  144: { 'zh-CN': '降低键盘灯光亮度', en: 'Decrease keyboard backlight brightness' },
  145: { 'zh-CN': '提高键盘灯光亮度', en: 'Increase keyboard backlight brightness' },
  207: { 'zh-CN': '原生 Fn 报告；需要键盘 Mac 模式，识别待实测；不是 NIZ 层 Fn', en: 'Native Fn report; requires keyboard Mac mode, recognition unverified. Separate from NIZ layer Fn' },
  208: { 'zh-CN': '原生屏幕亮度码；限 ATOM66 RGB BLE V1.5.1 / V1.5.1-F.1', en: 'Native display brightness; ATOM66 RGB BLE V1.5.1 / V1.5.1-F.1 only' },
  209: { 'zh-CN': '原生屏幕亮度码；限 ATOM66 RGB BLE V1.5.1 / V1.5.1-F.1', en: 'Native display brightness; ATOM66 RGB BLE V1.5.1 / V1.5.1-F.1 only' },
  ...Object.fromEntries([222, 223, 224, 225, 229, 230].map(code => [code, {
    'zh-CN': '原生 HID 码；需要 Mac V1.5.1-F.1 实验固件，实机未验证',
    en: 'Native HID code; requires experimental Mac V1.5.1-F.1 firmware, hardware unverified',
  }])),
  226: { 'zh-CN': '原生 HID 码；需要 Mac V1.5.1-F.1 实验固件，仅 USB，实机未验证', en: 'Native HID code; requires experimental Mac V1.5.1-F.1 firmware. USB only, hardware unverified' },
  227: { 'zh-CN': 'Apple 原生背光码；需要 V1.5.1-F.1 及键盘 Mac 模式，效果待实测', en: 'Apple native backlight code; requires V1.5.1-F.1 and keyboard Mac mode, effects unverified' },
  228: { 'zh-CN': 'Apple 原生背光码；需要 V1.5.1-F.1 及键盘 Mac 模式，效果待实测', en: 'Apple native backlight code; requires V1.5.1-F.1 and keyboard Mac mode, effects unverified' },
};
export function keyDescription(code: number, locale: Locale): string | undefined {
  return KEY_DESCRIPTIONS[code]?.[locale];
}
export function localizedKeyName(code: number, locale: Locale): string {
  return (
    SIDED_KEY_NAMES[code] ??
    (locale === 'en' ? ENGLISH_KEY_NAMES : KEY_NAMES)[code] ?? translate(locale, 'keyboard.unknown', { code })
  );
}

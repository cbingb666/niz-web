import { Globe, Mic, Moon, Search, Sun, SunDim, Volume, Volume1, Volume2 } from 'lucide-react';

/** Familiar Mac keycap symbols; the containing control supplies the full name. */
export function KeyActionIcon({ code }: { code: number }) {
  const props = { className: 'key-action-icon', 'aria-hidden': true as const, focusable: false as const, 'data-key-icon': code };
  switch (code) {
    case 208: return <SunDim {...props} />;
    case 209: return <Sun {...props} />;
    case 224: return <Search {...props} />;
    case 225: return <Mic {...props} />;
    case 226: return <Moon {...props} />;
    case 112: return <Volume {...props} />;
    case 114: return <Volume1 {...props} />;
    case 113: return <Volume2 {...props} />;
    case 222: return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2.5" y="3.5" width="19" height="17" rx="1.5" />
      <rect x="5" y="6" width="8" height="5" rx=".5" /><rect x="15" y="6" width="4" height="5" rx=".5" />
      <rect x="8" y="13" width="11" height="5" rx=".5" />
    </svg>;
    case 223: return <svg {...props} viewBox="0 0 24 24" fill="currentColor">
      {[4, 10, 16].flatMap(x => [4, 10, 16].map(y => <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx=".6" />))}
    </svg>;
    case 109:
    case 229: return <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M11 5v14L1 12Zm11 0v14l-10-7Z" /></svg>;
    case 108:
    case 230: return <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="m2 5 10 7-10 7Zm11 0 10 7-10 7Z" /></svg>;
    case 111: return <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="m2 5 10 7-10 7Z" /><rect x="14" y="5" width="3" height="14" /><rect x="20" y="5" width="3" height="14" /></svg>;
    case 227:
    case 228: return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 19h18M7 16a5 5 0 0 1 10 0M12 4v3M3 8l2 2M21 8l-2 2M2 14h2M20 14h2" />
      {code === 228 && <path d="m7 5 1 3M17 5l-1 3" />}
    </svg>;
    case 207: return <Globe {...props} />;
    default: return null;
  }
}

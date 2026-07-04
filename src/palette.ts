export type Theme = 'Paper' | 'Midnight';

export interface Palette {
  bg: string;
  panel: string;
  navBg: string;
  ink: string;
  mut: string;
  faint: string;
  line: string;
  chip: string;
  chipInk: string;
}

export function pal(theme: Theme): Palette {
  const dark = theme === 'Midnight';
  return dark
    ? {
        bg: '#151119',
        panel: '#1e1926',
        navBg: 'rgba(21,17,25,.82)',
        ink: '#f3efe9',
        mut: 'rgba(243,239,233,.56)',
        faint: 'rgba(243,239,233,.34)',
        line: 'rgba(255,255,255,.1)',
        chip: 'rgba(255,255,255,.06)',
        chipInk: 'rgba(243,239,233,.8)',
      }
    : {
        bg: '#f4efe7',
        panel: '#fbf8f2',
        navBg: 'rgba(244,239,231,.82)',
        ink: '#1a1512',
        mut: 'rgba(26,21,18,.56)',
        faint: 'rgba(26,21,18,.34)',
        line: 'rgba(26,21,18,.1)',
        chip: 'rgba(26,21,18,.055)',
        chipInk: 'rgba(26,21,18,.72)',
      };
}

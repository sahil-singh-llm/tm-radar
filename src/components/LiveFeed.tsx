import { memo } from 'react';

export type FeedEntry = {
  domain: string;
  flagged: boolean;
  ts: number;
};

type Props = {
  entries: FeedEntry[];
};

export const LiveFeed = memo(function LiveFeed({ entries }: Props) {
  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
          <span className="w-1 h-3 bg-low inline-block animate-pulse" />
          Live Certificate Feed
        </h2>
        <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
          last {entries.length}
        </span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ul className="text-[12px] font-mono leading-snug">
          {entries.map((e) => (
            <li
              key={e.ts + ':' + e.domain}
              className={`px-4 py-1 truncate ${
                e.flagged
                  ? 'bg-medium/10 text-medium border-l-2 border-medium'
                  : 'text-muted hover:text-text hover:bg-surface-2'
              } animate-feedIn`}
              title={e.domain}
            >
              <span className="text-border mr-2">›</span>
              {e.domain}
            </li>
          ))}
          {entries.length === 0 && (
            <li className="px-4 py-6 text-center text-muted text-xs italic">
              awaiting certificate stream...
            </li>
          )}
        </ul>
      </div>
    </div>
  );
});

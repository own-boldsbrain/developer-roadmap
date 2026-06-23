import { PartyPopper } from 'lucide-react';

export function AppChecklist() {
  return (
    <div className="fixed right-3 bottom-6">
      <a
        href="/get-started"
        className="flex items-center gap-2 rounded-full border border-slate-900 bg-white py-2 pr-4 pl-3 text-sm font-medium hover:bg-zinc-200"
      >
        <PartyPopper className="relative -top-[2px] h-[20px] w-[20px] text-purple-600" />
        Welcome! Start here
      </a>
    </div>
  );
}

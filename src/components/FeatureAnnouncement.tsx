import { useState } from 'react';
import { Modal } from './Modal.tsx';
import { PartyPopper, Play, PlayCircle } from 'lucide-react';
import { isMobileScreen } from '../lib/is-mobile.ts';

type FeatureAnnouncementProps = {};

export function FeatureAnnouncement(props: FeatureAnnouncementProps) {
  return null;
  return (
    <>
      <a
        className="rounded-md border border-dashed border-purple-600 px-3 py-1.5 text-purple-400 transition-colors hover:border-purple-400 hover:text-purple-200"
        href="/courses/sql"
      >
        <span className="relative mr-1 text-xs font-semibold text-white uppercase sm:-top-[1px]">
          <PartyPopper className="relative -top-[2px] mr-1 inline-block h-4 w-4" />
          Courses
        </span>{' '}
        <span className={'hidden sm:inline'}>
          Our first paid course about SQL is now live!
        </span>
        <span className={'inline text-sm sm:hidden'}>
          Our SQL course is now live!
        </span>
      </a>
    </>
  );
}

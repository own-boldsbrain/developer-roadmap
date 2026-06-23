import { cn } from '../../lib/classname';
import { ResourceProgressStats } from './ResourceProgressStats';

type RoadmapHintProps = {
  roadmapId: string;
  roadmapTitle: string;
};

export function RoadmapHint(props: RoadmapHintProps) {
  const { roadmapTitle, roadmapId } = props;

  return (
    <div
      className={cn(
        'mt-4 mb-0 rounded-md border-0 sm:mt-7 sm:-mb-[65px] sm:border',
      )}
    >
      <ResourceProgressStats
        isSecondaryBanner={false}
        resourceId={roadmapId}
        resourceType="roadmap"
      />
    </div>
  );
}

import type { VideoFileType } from '../../lib/video';

export interface VideoListItemProps {
  video: VideoFileType;
}

export function VideoListItem(props: VideoListItemProps) {
  const { video } = props;
  const { frontmatter, id } = video;

  return (
    <a
      className="group text-md block flex items-center justify-between border-b py-2 text-gray-600 no-underline hover:text-blue-600"
      href={`/videos/${id}`}
    >
      <span className="transition-transform group-hover:translate-x-2">
        {frontmatter.title}

        {frontmatter.isNew && (
          <span className="ml-1.5 rounded-xs bg-green-300 px-1.5 py-0.5 text-xs font-medium text-green-900 uppercase">
            New
            <span className="hidden sm:inline">
              &middot;
              {new Date(frontmatter.date).toLocaleString('default', {
                month: 'long',
              })}
            </span>
          </span>
        )}
      </span>
      <span className="hidden text-xs text-gray-500 capitalize sm:block">
        {frontmatter.duration}
      </span>

      <span className="block text-xs text-gray-400 sm:hidden"> &raquo;</span>
    </a>
  );
}

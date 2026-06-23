import { cn } from '../../../lib/classname.ts';

type StepperStepSeparatorProps = {
  isActive: boolean;
};

export function StepperStepSeparator(props: StepperStepSeparatorProps) {
  const { isActive } = props;

  return (
    <hr
      className={cn('hidden grow border border-gray-300 sm:flex', {
        'border-green-500': isActive,
      })}
    />
  );
}

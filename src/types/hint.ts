export type HintAlign = 'start' | 'end';

export type FieldHintProps = {
  label: string;
  name: string;
  openName: string | null;
  onOpenChange: (name: string | null) => void;
  align?: HintAlign;
  children: string;
};

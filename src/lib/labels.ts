export type LabelDef = {
  id: string;
  name: string;
  emoji: string;
};

export const LABEL_DEFS: LabelDef[] = [
  { id: "eatout", name: "外食", emoji: "🍴" },
  { id: "cheat", name: "チートデー", emoji: "🍔" },
  { id: "drinking", name: "飲み会", emoji: "🍺" },
  { id: "exercise", name: "運動", emoji: "💪" },
  { id: "travel", name: "旅行", emoji: "✈️" },
  { id: "sick", name: "体調不良", emoji: "🤒" },
];

const BY_ID = new Map(LABEL_DEFS.map((d) => [d.id, d]));

export function getLabelDef(id: string): LabelDef | undefined {
  return BY_ID.get(id);
}

interface Load {
  id: string;
  type: "point" | "distributed";
  magnitude: number;
  position?: number;
  start?: number;
  end?: number;
}

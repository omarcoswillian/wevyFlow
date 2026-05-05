import React from "react";

export interface FieldDef {
  id: string;
  label: string;
  type: "text" | "color" | "textarea";
  default: string;
  placeholder?: string;
  hint?: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  client: string;
  referencePath: string;
  format: string;
  w: number;
  h: number;
  fields: FieldDef[];
  render: (v: Record<string, string>) => React.ReactElement;
}

export const CREATIVE_TEMPLATES: TemplateDef[] = [];

export interface Output {
  Transcoder: string,
  Meta: Record<string, string>
  Pages: Page[]
}

export interface Page {
  Width: number
  Height: number
  HLines: Line[]
  VLines: Line[]
  Fills: Fill[]
  Texts: Text[]
}

export interface Fill {
  x: number,
  y: number,
  w: number,
  h: number,
  oc?: string,
  clr?: number
}

export interface Line {
  x: number,
  y: number,
  w: number,
  oc?: string,
  clr?:number
}

export interface Text {
  x: number,
  y: number,
  w: number,
  sw: number,
  A: 'left' | 'center' | 'right',
  R: TextRun[]
  oc?:string;
  clr?: number;
}

export interface TextRun {
  T: string,
  S: number,
  TS: [number, number, 0|1, 0|1]
  RA?: number
}

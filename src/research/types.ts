export interface ResearchPaperPick {
  title: string
  blurb: string
  field: string
  year: number | null
  venue: string | null
  paperUrl: string | null
  pdfUrl: string
}

export interface ResearchShortlist {
  picks: ResearchPaperPick[]
}

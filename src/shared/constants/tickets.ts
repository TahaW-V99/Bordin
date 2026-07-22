export const TICKET_ASSETS = [
  {
    id: "legends-cup",
    walletField: "legendsCupTickets" as const,
    title: "بلیط کاپ (لجندز مود)",
    image: "/images/tickets/ticket-cup-legends.png",
  },
  {
    id: "normal-cup",
    walletField: "normalCupTickets" as const,
    title: "بلیط کاپ (نرمال مود)",
    image: "/images/tickets/ticket-cup-normal.png",
  },
  {
    id: "tournament",
    walletField: "tournamentTickets" as const,
    title: "بلیط تورنومنت",
    image: "/images/tickets/ticket-tournament.png",
  },
  {
    id: "team-competition",
    walletField: "teamCompetitionTickets" as const,
    title: "بلیط رقابت تیمی",
    image: "/images/tickets/ticket-team-competition.png",
  },
] as const;

export type TicketWalletField = (typeof TICKET_ASSETS)[number]["walletField"];

export function getTicketAssetByWalletField(field: TicketWalletField) {
  return TICKET_ASSETS.find((asset) => asset.walletField === field);
}


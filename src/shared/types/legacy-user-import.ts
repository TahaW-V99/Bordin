export type LegacyUserRow = {
  phone: string;
  sellableCoins: number;
  systemCoins: number;
  purchasedCoins: number;
  points: number;
  cupMedals: string;
  tournamentMedals: string;
  honorMedals: string;
  inviteCount: number;
  predictionCount: number;
  perfectPredictionCount: number;
};

export type LegacyUserImportReport = {
  importBatchId: string;
  totalRows: number;
  migratedExistingUsers: string[];
  pendingUsersCreated: string[];
  pendingUsersUpdated: string[];
  failedRows: Array<{ phone: string; error: string }>;
  duplicateRowsSkipped: string[];
  alreadyAppliedSkipped: string[];
};

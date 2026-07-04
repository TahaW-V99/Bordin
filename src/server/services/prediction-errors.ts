export class DisplayNameRequiredError extends Error {
  code = "DISPLAY_NAME_REQUIRED" as const;
  constructor() {
    super("DISPLAY_NAME_REQUIRED");
  }
}
